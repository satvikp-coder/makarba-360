import { mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checksum, loadMigrations, migrate, MigrationError, MIGRATIONS_DIR } from "./index.js";

// ---------- pure tests (always run) ----------
describe("migration files", () => {
  const dir = (files: Record<string, string>) => {
    const d = mkdtempSync(join(tmpdir(), "mig-"));
    for (const [n, s] of Object.entries(files)) writeFileSync(join(d, n), s);
    return d;
  };
  it("loads the shipped migrations contiguously with checksums", () => {
    const m = loadMigrations(MIGRATIONS_DIR);
    expect(m.map((x) => x.version)).toEqual(["0001", "0002", "0003"]);
    expect(m.every((x) => /^[0-9a-f]{64}$/.test(x.checksum))).toBe(true);
  });
  it("normalises CRLF so Windows and Linux checksums agree", () => {
    expect(checksum("a\r\nb")).toBe(checksum("a\nb"));
  });
  it("rejects bad names, gaps and duplicates", () => {
    expect(() => loadMigrations(dir({ "x.sql": "" }))).toThrow(MigrationError);
    expect(() => loadMigrations(dir({ "0001_a.sql": "", "0003_c.sql": "" }))).toThrow(/contiguous/);
    expect(() => loadMigrations(dir({ "0001_a.sql": "", "0001_b.sql": "" }))).toThrow(/Duplicate|contiguous/);
  });
});

// ---------- database tests (CI: PostGIS container; skipped locally without TEST_DATABASE_URL) ----------
const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");

describe.skipIf(!url)("PostGIS migrations (database)", () => {
  let c: pg.Client;
  const migrations = loadMigrations(MIGRATIONS_DIR);
  const run = (upTo?: string) => migrate(c, migrations, { asRole: "makarba_migrator", upTo });

  /** Run SQL as a role; returns { ok, code } where code is the SQLSTATE on failure. */
  async function as(role: string, sql: string): Promise<{ ok: boolean; code?: string }> {
    await c.query("BEGIN");
    try {
      await c.query(`SET LOCAL ROLE ${role}`);
      await c.query(sql);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: (e as { code?: string }).code };
    } finally {
      await c.query("ROLLBACK");
    }
  }

  beforeAll(async () => {
    c = new pg.Client({ connectionString: url });
    await c.connect();
  });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
  });

  const AREA = "'00000000-0000-4000-8000-0000000000a1'";
  const poly = "ST_GeomFromText('MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))',4326)"; // synthetic, outside Makarba
  const seedArea = `INSERT INTO private.study_areas (id, version, name, geometry) VALUES (${AREA}, 1, 'synthetic area', ${poly})`;
  const seedCat = "INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage', '{\"en\":\"Heritage\"}', 'i')";
  const loc = (id: string, wkt: string, extra = "") =>
    `INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry${extra ? ", " + extra.split("|")[0] : ""}) VALUES ('${id}', ${AREA}, 1, 'heritage', '{"en":"x"}', ST_GeomFromText('${wkt}', 4326)${extra ? ", " + extra.split("|")[1] : ""})`;

  it("migrates an empty database and is idempotent", async () => {
    expect(await run()).toEqual(["0001", "0002", "0003"]);
    expect(await run()).toEqual([]);
    const r = await c.query("SELECT version FROM migrations.applied ORDER BY version");
    expect(r.rows.map((x) => x.version)).toEqual(["0001", "0002", "0003"]);
  });

  it("upgrades a prior-version database without losing data", async () => {
    expect(await run("0001")).toEqual(["0001"]);
    await c.query("SET ROLE makarba_migrator");
    await c.query(seedArea); await c.query(seedCat);
    await c.query(loc("00000000-0000-4000-8000-0000000000b1", "POINT(10.5 10.5)"));
    await c.query("RESET ROLE");
    expect(await run()).toEqual(["0002", "0003"]);
    const r = await c.query("SELECT count(*)::int AS n FROM private.locations");
    expect(r.rows[0].n).toBe(1);
  });

  it("refuses to run when an applied migration was edited", async () => {
    await run();
    await c.query("UPDATE migrations.applied SET checksum = 'tampered' WHERE version = '0001'");
    await expect(run()).rejects.toThrow(/modified after it was applied/);
  });

  it("rolls back a failing migration completely", async () => {
    const bad = [...migrations, { version: "0004", name: "bad", sql: "CREATE TABLE private.half_done (id int); SELECT 1/0;", checksum: checksum("bad") }];
    await expect(migrate(c, bad, { asRole: "makarba_migrator" })).rejects.toThrow(/rolled back/);
    const t = await c.query("SELECT to_regclass('private.half_done') AS t");
    expect(t.rows[0].t).toBeNull();
    const v = await c.query("SELECT version FROM migrations.applied ORDER BY version");
    expect(v.rows.map((x) => x.version)).toEqual(["0001", "0002", "0003"]);
  });

  describe("geometry integrity", () => {
    beforeEach(async () => {
      await run();
      await c.query("SET ROLE makarba_migrator");
      await c.query(seedArea); await c.query(seedCat);
      await c.query("RESET ROLE");
    });
    const insert = async (wkt: string) => {
      await c.query("SET ROLE makarba_migrator");
      try { await c.query(loc("00000000-0000-4000-8000-0000000000c1", wkt)); return "ok"; }
      catch (e) { return (e as { code?: string }).code ?? "error"; }
      finally { await c.query("RESET ROLE"); }
    };
    it("accepts valid point, route and area", async () => {
      expect(await insert("POINT(10.5 10.5)")).toBe("ok");
    });
    it.each([
      ["wrong type (Polygon, not Multi)", "POLYGON((10 10,11 10,11 11,10 10))"],
      ["geometry collection", "GEOMETRYCOLLECTION(POINT(10 10))"],
      ["self-intersecting area", "MULTIPOLYGON(((10 10,11 11,11 10,10 11,10 10)))"],
      ["out-of-range longitude", "POINT(200 10)"],
      ["out-of-range latitude", "POINT(10 95)"],
      ["empty geometry", "POINT EMPTY"],
    ])("rejects %s", async (_n, wkt) => {
      expect(await insert(wkt)).toBe("23514"); // check_violation
    });
    it("rejects 3D geometry (column typmod is 2D)", async () => {
      expect(["22023", "23514"]).toContain(await insert("POINT Z (10.5 10.5 3)"));
    });
    it("rejects a location in an unknown study area (FK)", async () => {
      await c.query("SET ROLE makarba_migrator");
      await expect(c.query("INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry) VALUES (gen_random_uuid(), gen_random_uuid(), 1, 'heritage', '{}', ST_GeomFromText('POINT(10.5 10.5)',4326))")).rejects.toMatchObject({ code: "23503" });
      await c.query("RESET ROLE");
    });
    it("records an immutable geometry revision history", async () => {
      await insert("POINT(10.5 10.5)");
      await c.query("SET ROLE makarba_migrator");
      await c.query("UPDATE private.locations SET geometry = ST_GeomFromText('POINT(10.6 10.6)',4326)");
      await c.query("RESET ROLE");
      const r = await c.query("SELECT revision FROM audit.location_geometry_revisions ORDER BY revision");
      expect(r.rows.map((x) => x.revision)).toEqual([1, 2]);
      expect((await as("makarba_private_api", "UPDATE audit.location_geometry_revisions SET revision = 9")).code).toBe("42501");
    });
  });

  it("creates GiST spatial indexes and FK indexes", async () => {
    await run();
    const r = await c.query("SELECT indexdef FROM pg_indexes WHERE schemaname IN ('private','published') AND indexdef ILIKE '%USING gist%'");
    const defs = r.rows.map((x) => x.indexdef as string).join("\n");
    for (const t of ["private.study_areas", "private.locations", "published.locations"]) expect(defs).toContain(t);
  });

  describe("explicit restricted / public grants", () => {
    beforeEach(async () => { await run(); });
    it("public role cannot touch any private or audit table, present or future", async () => {
      // Includes a synthetic interview table created later by the migrator (default privileges).
      await c.query("SET ROLE makarba_migrator");
      await c.query("CREATE TABLE private.synthetic_interviews (id int, note text)");
      await c.query("RESET ROLE");
      const t = await c.query(`SELECT n.nspname || '.' || c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                               WHERE c.relkind IN ('r','p','v','m') AND n.nspname IN ('private','audit','migrations')`);
      expect(t.rows.length).toBeGreaterThan(3);
      for (const { name } of t.rows) {
        expect((await as("makarba_public_api", `SELECT * FROM ${name}`)).code, name).toBe("42501");
        expect((await as("makarba_public_api", `INSERT INTO ${name} SELECT * FROM ${name}`)).code, name).toBe("42501");
      }
    });
    it("public role may only read published tables", async () => {
      const t = await c.query("SELECT 'published.' || relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'published' AND c.relkind = 'r'");
      expect(t.rows.length).toBeGreaterThan(0);
      for (const { name } of t.rows) {
        expect((await as("makarba_public_api", `SELECT * FROM ${name}`)).ok, name).toBe(true);
        expect((await as("makarba_public_api", `DELETE FROM ${name}`)).code, name).toBe("42501");
      }
    });
    it("runtime roles cannot run DDL or touch the migration ledger", async () => {
      for (const role of ["makarba_public_api", "makarba_private_api", "makarba_worker"]) {
        expect((await as(role, "CREATE TABLE private.evil (id int)")).code, role).toBe("42501");
        expect((await as(role, "ALTER TABLE private.locations ADD COLUMN evil int")).code, role).toBe("42501");
        expect((await as(role, "SELECT * FROM migrations.applied")).code, role).toBe("42501");
      }
    });
    it("only the worker can write the public projection", async () => {
      const row = "INSERT INTO published.locations (id, slug, category_id, name, geometry, last_reviewed_at, revision, snapshot_id) VALUES (gen_random_uuid(), 'a', 'heritage', '{}', ST_GeomFromText('POINT(10.5 10.5)',4326), now(), 1, 's')";
      expect((await as("makarba_worker", row)).ok).toBe(true);
      expect((await as("makarba_public_api", row)).code).toBe("42501");
      expect((await as("makarba_private_api", row)).code).toBe("42501");
    });
  });
});
