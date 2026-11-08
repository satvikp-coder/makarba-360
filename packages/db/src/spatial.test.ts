import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "./index.js";

// Spatial invariants and upgrade paths (issue #108). Runs in the CI `database` job against a real PostGIS container and is
// skipped locally without TEST_DATABASE_URL. All geometry is synthetic (around 10,10), not Makarba.
const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");

describe.skipIf(!url)("spatial invariants and migration paths (database)", () => {
  let c: pg.Client;
  const migrations = loadMigrations(MIGRATIONS_DIR);
  const run = (upTo?: string) => migrate(c, migrations, { asRole: "makarba_migrator", upTo });
  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
  });

  /** Runs one statement as the migrator role and reports "ok" or the SQLSTATE. Always rolled back. */
  async function attempt(sql: string): Promise<string> {
    await c.query("BEGIN");
    try { await c.query("SET LOCAL ROLE makarba_migrator"); await c.query(sql); return "ok"; }
    catch (e) { return (e as { code?: string }).code ?? "error"; }
    finally { await c.query("ROLLBACK"); }
  }
  const tables = async () => (await c.query("SELECT table_schema || '.' || table_name AS t FROM information_schema.tables WHERE table_schema IN ('private','published','audit','migrations') ORDER BY 1")).rows.map((r) => r.t as string);
  const columns = async () => (await c.query("SELECT table_schema || '.' || table_name || '.' || column_name || ':' || data_type AS col FROM information_schema.columns WHERE table_schema IN ('private','published','audit') ORDER BY 1")).rows.map((r) => r.col as string);

  describe("empty and upgrade paths", () => {
    it("applying versions one at a time ends in the same schema as applying them all at once", async () => {
      await run();
      const [allTables, allCols] = [await tables(), await columns()];
      await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
      await c.query(bootstrap);
      for (const m of migrations) expect(await run(m.version)).toEqual([m.version]);
      expect(await tables()).toEqual(allTables);
      expect(await columns()).toEqual(allCols);
      expect(await run()).toEqual([]);
    });
    it("upgrading from every intermediate version reaches the latest without error", async () => {
      for (const from of migrations.slice(0, -1)) {
        await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
        await c.query(bootstrap);
        await run(from.version);
        const applied = await run();
        expect(applied[0]).not.toBe(from.version);
        expect((await c.query("SELECT count(*)::int AS n FROM migrations.applied")).rows[0].n).toBe(migrations.length);
      }
    });
  });

  describe("geometry that must never reach the published projection", () => {
    beforeEach(async () => { await run(); });
    const pub = (geomSql: string) => `INSERT INTO published.locations (id, slug, category_id, name, geometry, last_reviewed_at, revision, snapshot_id) VALUES (gen_random_uuid(), 's-${Math.random().toString(36).slice(2, 8)}', 'heritage', '{"en":"x"}', ${geomSql}, now(), 1, 'snap')`;
    const wkt = (w: string, srid = 4326) => `ST_GeomFromText('${w}', ${srid})`;
    it("accepts a valid point, route and area in EPSG:4326", async () => {
      for (const w of ["POINT(10.5 10.5)", "MULTILINESTRING((10 10,10.5 10.5))", "MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))"]) expect(await attempt(pub(wkt(w))), w).toBe("ok");
    });
    it("rejects a missing geometry", async () => {
      expect(await attempt(pub("NULL"))).toBe("23502");
    });
    it("rejects geometry in the wrong coordinate system (Web Mercator, unknown SRID)", async () => {
      for (const srid of [3857, 0, 32643]) expect(await attempt(pub(wkt("POINT(1170000 1170000)", srid))), `srid ${srid}`).not.toBe("ok");
    });
    it("rejects invalid, empty, wrong-type and out-of-range geometry", async () => {
      const cases: [string, string][] = [
        ["bow-tie polygon", "MULTIPOLYGON(((10 10,11 11,11 10,10 11,10 10)))"],
        ["empty", "POINT EMPTY"],
        ["plain polygon (not multi)", "POLYGON((10 10,11 10,11 11,10 10))"],
        ["geometry collection", "GEOMETRYCOLLECTION(POINT(10 10))"],
        ["longitude 181", "POINT(181 10)"],
        ["latitude -91", "POINT(10 -91)"],
      ];
      for (const [n, w] of cases) expect(await attempt(pub(wkt(w))), n).toBe("23514");
    });
    it("rejects 3D geometry", async () => {
      expect(["22023", "23514"]).toContain(await attempt(pub(wkt("POINT Z (10 10 5)"))));
    });
    it("a candidate or approved location cannot be in a published state without a review date", async () => {
      await c.query("SET ROLE makarba_migrator");
      await c.query("INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('00000000-0000-4000-8000-0000000000a1', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))',4326))");
      await c.query("INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark')");
      await c.query("RESET ROLE");
      const ins = (state: string) => `INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry, state) VALUES (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', 1, 'heritage', '{"en":"x"}', ST_GeomFromText('POINT(10.5 10.5)',4326), '${state}')`;
      expect(await attempt(ins("published"))).toBe("23514");
      expect(await attempt(ins("approved"))).toBe("23514");
      expect(await attempt(ins("candidate"))).toBe("ok");
    });
  });

  describe("edge membership against the study area", () => {
    beforeEach(async () => {
      await run();
      await c.query("SET ROLE makarba_migrator");
      await c.query("INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('00000000-0000-4000-8000-0000000000a1', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))',4326))");
      await c.query("RESET ROLE");
    });
    const covers = async (wkt: string) => (await c.query("SELECT ST_Covers(geometry, ST_GeomFromText($1, 4326)) AS inside FROM private.study_areas", [wkt])).rows[0].inside as boolean;
    it("a point exactly on an edge or corner counts as inside (covers), consistent with the application rule", async () => {
      expect(await covers("POINT(10 10.5)")).toBe(true);     // on the west edge
      expect(await covers("POINT(11 11)")).toBe(true);       // on a corner
      expect(await covers("POINT(10.5 10.5)")).toBe(true);   // interior
    });
    it("a point just outside is outside, however small the gap", async () => {
      expect(await covers("POINT(9.999999 10.5)")).toBe(false);
      expect(await covers("POINT(11.000001 11)")).toBe(false);
    });
    it("a route that leaves the area is not covered; one that only touches the edge is", async () => {
      expect(await covers("LINESTRING(10.2 10.2,11.5 10.2)")).toBe(false);
      expect(await covers("LINESTRING(10 10,10 11)")).toBe(true);
    });
    it("strict containment (ST_Contains) would exclude the edge, which is why the rule is covers", async () => {
      const r = await c.query("SELECT ST_Contains(geometry, ST_GeomFromText('POINT(10 10.5)', 4326)) AS c FROM private.study_areas");
      expect(r.rows[0].c).toBe(false);
    });
  });
});
