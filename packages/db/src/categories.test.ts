import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "./index.js";

// Category taxonomy (issue #26). CI `database` job, real PostGIS; skipped locally without TEST_DATABASE_URL. Synthetic data only.
const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";

describe.skipIf(!url)("location category taxonomy (database)", () => {
  let c: pg.Client;
  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  afterEach(async () => { await c.query("ROLLBACK"); });
  beforeEach(async () => {
    await c.query("RESET ROLE");
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
    await migrate(c, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    await c.query("BEGIN");
    await c.query("SET ROLE makarba_migrator");
    await c.query(`INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('${AREA}', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((10 10,11 10,11 11,10 11,10 10)))',4326))`);
  });

  /** One statement inside a savepoint: "ok" or the SQLSTATE. */
  async function attempt(sql: string, params: unknown[] = []): Promise<string> {
    await c.query("SAVEPOINT s");
    try { await c.query(sql, params); await c.query("RELEASE SAVEPOINT s"); return "ok"; }
    catch (e) { await c.query("ROLLBACK TO SAVEPOINT s"); return (e as { code?: string }).code ?? "error"; }
  }
  const cat = (id: string, icon: string, labels = '{"en":"Label"}') => attempt("INSERT INTO private.location_categories (id, labels, icon) VALUES ($1, $2::jsonb, $3)", [id, labels, icon]);
  const place = (cat_id: string) => attempt(
    `INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry) VALUES (gen_random_uuid(), '${AREA}', 1, $1, '{"en":"x"}', ST_GeomFromText('POINT(10.5 10.5)',4326))`, [cat_id]);

  it("accepts a valid category and rejects malformed codes, icons, colours and label sets", async () => {
    expect(await cat("heritage", "landmark")).toBe("ok");
    expect(await cat("Bad-Code", "x-icon")).toBe("23514");
    expect(await cat("shortic", "A")).toBe("23514");
    expect(await cat("nolabel", "map-pin", '{"gu":"x"}')).toBe("23514");
    expect(await cat("blank", "map-pin", '{"en":"  "}')).toBe("23514");
    expect(await cat("numlabel", "map-pin", '{"en":"ok","gu":3}')).toBe("23514");
    expect(await attempt("INSERT INTO private.location_categories (id, labels, icon, color_token) VALUES ('colr','{\"en\":\"c\"}','map-pin','#fff')")).toBe("23514");
  });

  it("refuses a duplicate code and a duplicate icon among active categories", async () => {
    expect(await cat("heritage", "landmark")).toBe("ok");
    expect(await cat("heritage", "droplet")).toBe("23505");
    expect(await cat("water", "landmark")).toBe("23505");
  });

  it("a category can be archived: history is untouched, new use is refused, its icon is freed", async () => {
    await cat("heritage", "landmark"); await cat("water", "droplet");
    expect(await place("heritage")).toBe("ok");
    expect(await attempt("UPDATE private.location_categories SET archived = true, archived_at = now(), replaced_by = 'water' WHERE id = 'heritage'")).toBe("ok");
    expect((await c.query("SELECT count(*)::int AS n FROM private.locations WHERE category_id = 'heritage'")).rows[0].n).toBe(1);
    expect(await place("heritage")).toBe("23001");
    expect(await place("water")).toBe("ok");
    expect(await cat("monument", "landmark")).toBe("ok");
    expect(await attempt("UPDATE private.location_categories SET archived = false, archived_at = null WHERE id = 'heritage'")).toBe("23505");
  });

  it("a place that already uses an archived category can still be edited, but cannot be moved onto one", async () => {
    await cat("heritage", "landmark"); await cat("water", "droplet");
    await place("heritage");
    await c.query("UPDATE private.location_categories SET archived = true, archived_at = now() WHERE id = 'heritage'");
    expect(await attempt("UPDATE private.locations SET aliases = '[\"a\"]'::jsonb WHERE category_id = 'heritage'")).toBe("ok");
    await place("water");
    expect(await attempt("UPDATE private.locations SET category_id = 'heritage' WHERE category_id = 'water'")).toBe("23001");
  });

  it("codes are stable and categories can never be deleted or renamed; archive flag and timestamp must agree", async () => {
    await cat("heritage", "landmark");
    expect(await attempt("DELETE FROM private.location_categories WHERE id = 'heritage'")).toBe("23001");
    expect(await attempt("UPDATE private.location_categories SET id = 'heritage2' WHERE id = 'heritage'")).toBe("23001");
    expect(await attempt("UPDATE private.location_categories SET archived = true WHERE id = 'heritage'")).toBe("23514");
    expect(await attempt("UPDATE private.location_categories SET replaced_by = 'heritage' WHERE id = 'heritage'")).toBe("23514");
  });

  it("a replacement must exist and be active", async () => {
    await cat("heritage", "landmark"); await cat("water", "droplet");
    await c.query("UPDATE private.location_categories SET archived = true, archived_at = now() WHERE id = 'water'");
    expect(await attempt("UPDATE private.location_categories SET replaced_by = 'water' WHERE id = 'heritage'")).toBe("23001");
    expect(await attempt("UPDATE private.location_categories SET replaced_by = 'ghost' WHERE id = 'heritage'")).toBe("23503");
  });

  it("every create, update, archive and restore is recorded in the append-only audit table", async () => {
    await cat("heritage", "landmark");
    await c.query("UPDATE private.location_categories SET sort_order = 3 WHERE id = 'heritage'");
    await c.query("UPDATE private.location_categories SET archived = true, archived_at = now() WHERE id = 'heritage'");
    await c.query("UPDATE private.location_categories SET archived = false, archived_at = null WHERE id = 'heritage'");
    const r = await c.query("SELECT action FROM audit.location_category_events WHERE category_id = 'heritage' ORDER BY id");
    expect(r.rows.map((x) => x.action)).toEqual(["create", "update", "archive", "restore"]);
    await c.query("RESET ROLE");
    for (const role of ["makarba_private_api", "makarba_worker", "makarba_public_api"]) {
      await c.query(`SET ROLE ${role}`);
      expect(await attempt("DELETE FROM audit.location_category_events")).toBe("42501");
      expect(await attempt("UPDATE audit.location_category_events SET action = 'x'")).toBe("42501");
      await c.query("RESET ROLE");
    }
  });

  it("the private API role can create and archive categories but cannot delete them; the public role reads only the published read model", async () => {
    await c.query("RESET ROLE");
    await c.query("SET ROLE makarba_private_api");
    expect(await cat("heritage", "landmark")).toBe("ok");
    expect(await attempt("DELETE FROM private.location_categories WHERE id = 'heritage'")).toBe("42501");
    await c.query("RESET ROLE");
    await c.query("SET ROLE makarba_public_api");
    expect(await attempt("SELECT * FROM private.location_categories")).toBe("42501");
    expect(await attempt("SELECT * FROM published.categories")).toBe("ok");
    expect(await attempt("INSERT INTO published.categories (id, labels, icon) VALUES ('heritage','{}','landmark')")).toBe("42501");
    await c.query("RESET ROLE");
    await c.query("SET ROLE makarba_worker");
    expect(await attempt("INSERT INTO published.categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark')")).toBe("ok");
  });
});
