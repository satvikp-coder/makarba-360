import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { LocationRepoError, PgLocationRepository } from "./location-repository.js";

// CI `database` job on real PostGIS (skipped locally without TEST_DATABASE_URL). Synthetic geometry around (10,10) only.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";
const A = "00000000-0000-4000-8000-0000000000b1";
const B = "00000000-0000-4000-8000-0000000000b2";
const prov = { source: "synthetic exercise", method: "digitised" as const };
const pt = (x: number, y: number) => ({ type: "Point", coordinates: [x, y] });
const poly = { type: "MultiPolygon", coordinates: [[[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]] };
const bowtie = { type: "MultiPolygon", coordinates: [[[[10, 10], [11, 11], [11, 10], [10, 11], [10, 10]]]] };
const base = (over: object = {}) => ({ studyAreaId: AREA, studyAreaVersion: 1, categoryId: "heritage", name: { en: "Synthetic well" }, geometry: pt(10.5, 10.5), provenance: prov, ...over });

describe.skipIf(!url)("PgLocationRepository on PostGIS (issue #27) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, repo: PgLocationRepository;
  beforeAll(async () => { admin = new pg.Client({ connectionString: url }); await admin.connect(); app = new pg.Client({ connectionString: url }); await app.connect(); });
  afterAll(async () => { await admin.end(); await app.end(); });
  beforeEach(async () => {
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    await admin.query("SET ROLE makarba_migrator");
    await admin.query(`INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('${AREA}', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((9 9,12 9,12 12,9 12,9 9)))',4326))`);
    await admin.query("INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark'), ('water','{\"en\":\"W\"}','droplet')");
    await admin.query(`INSERT INTO private.users (id, oidc_subject) VALUES ('${A}', 'sub-a'), ('${B}', 'sub-b')`);
    await admin.query("RESET ROLE");
    await app.query("RESET ROLE");
    await app.query("SET ROLE makarba_private_api");       // the private API's real runtime role
    repo = new PgLocationRepository(app);
  });
  const code = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof LocationRepoError ? e.code : (e as { code?: string }).code ?? "error"));

  it("creates a candidate with provenance and the author; returns GeoJSON in WGS 84", async () => {
    const r = await repo.create(base(), A);
    expect(r).toMatchObject({ state: "candidate", revision: 1, proposedBy: A, provenance: prov, geometry: { type: "Point", coordinates: [10.5, 10.5] } });
  });

  it("supports route and area geometry and refuses empty, self-intersecting and out-of-range geometry at the database", async () => {
    expect(await code(repo.create(base({ geometry: { type: "MultiLineString", coordinates: [[[10, 10], [10.2, 10.3], [10.4, 10.1]]] } }), A))).toBe("ok");
    expect(await code(repo.create(base({ geometry: poly }), A))).toBe("ok");
    expect(await code(repo.create(base({ geometry: bowtie }), A))).toBe("rejected_value");
    expect(await code(repo.create(base({ geometry: { type: "Point", coordinates: [] } }), A))).toBe("rejected_value");
    expect(await code(repo.create(base({ geometry: pt(1_113_194, 1_118_889) }), A))).toBe("rejected_value");
    expect(await code(repo.create(base({ geometry: { type: "MultiPoint", coordinates: [[10, 10]] } }), A))).toBe("rejected_value");
  });

  it("refuses a missing or archived category", async () => {
    expect(await code(repo.create(base({ categoryId: "ghost" }), A))).toBe("rejected_value");
    await admin.query("UPDATE private.location_categories SET archived = true, archived_at = now() WHERE id = 'water'");
    expect(await code(repo.create(base({ categoryId: "water" }), A))).toBe("rejected_value");
  });

  it("rejects provenance the database does not accept even if the app layer were bypassed", async () => {
    await expect(app.query(`INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry, geometry_provenance)
      VALUES (gen_random_uuid(), '${AREA}', 1, 'heritage', '{"en":"x"}', ST_SetSRID(ST_MakePoint(10.5,10.5),4326), '{"source":"","method":"digitised"}')`)).rejects.toMatchObject({ code: "23514" });
    await expect(app.query(`INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry, geometry_provenance)
      VALUES (gen_random_uuid(), '${AREA}', 1, 'heritage', '{"en":"x"}', ST_SetSRID(ST_MakePoint(10.5,10.5),4326), '{"source":"s","method":"guess"}')`)).rejects.toMatchObject({ code: "23514" });
    // A place without provenance may stay a candidate but can never be reviewed.
    await expect(app.query(`INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry, state, last_reviewed_at)
      VALUES (gen_random_uuid(), '${AREA}', 1, 'heritage', '{"en":"x"}', ST_SetSRID(ST_MakePoint(10.5,10.5),4326), 'reviewed', now())`)).rejects.toMatchObject({ code: "23514" });
  });

  it("every geometry or provenance change is a new revision; the history keeps each one with its author", async () => {
    const r = await repo.create(base(), A);
    const c1 = await repo.proposeChange(r.id, 1, pt(10.6, 10.5), prov, B);
    expect(c1).toMatchObject({ revision: 2, proposedBy: B });
    const c2 = await repo.proposeChange(r.id, 2, pt(10.6, 10.5), { source: "second visit", method: "surveyed" }, B);   // provenance-only change
    expect(c2.revision).toBe(3);
    const revs = await repo.revisions(r.id);
    expect(revs.map((x) => [x.revision, x.changedBy])).toEqual([[1, A], [2, B], [3, B]]);
    expect(revs[0]!.geometry).toMatchObject({ coordinates: [10.5, 10.5] });
  });

  it("stale and unchanged submissions are refused and nothing is written", async () => {
    const r = await repo.create(base(), A);
    await repo.proposeChange(r.id, 1, pt(10.6, 10.5), prov, A);
    expect(await code(repo.proposeChange(r.id, 1, pt(10.7, 10.5), prov, A))).toBe("stale");
    expect(await code(repo.proposeChange(r.id, 2, pt(10.6, 10.5), prov, A))).toBe("unchanged");
    expect(await code(repo.proposeChange("00000000-0000-4000-8000-00000000ffff", 1, pt(10, 10), prov, A))).toBe("not_found");
    expect((await repo.revisions(r.id)).length).toBe(2);
  });

  it("two concurrent edits from the same revision: exactly one wins", async () => {
    const r = await repo.create(base(), A);
    const other = new pg.Client({ connectionString: url }); await other.connect(); await other.query("SET ROLE makarba_private_api");
    const repo2 = new PgLocationRepository(other);
    const results = await Promise.all([code(repo.proposeChange(r.id, 1, pt(10.6, 10.5), prov, A)), code(repo2.proposeChange(r.id, 1, pt(10.7, 10.5), prov, B))]);
    await other.end();
    expect(results.sort()).toEqual(["ok", "stale"]);
    expect((await repo.get(r.id))!.revision).toBe(2);
  });

  it("review is independent: the author cannot review; a reviewer can; the state moves to reviewed with a timestamp", async () => {
    const r = await repo.create(base(), A);
    expect(await code(repo.review(r.id, 1, A))).toBe("own_work");
    const done = await repo.review(r.id, 1, B);
    expect(done).toMatchObject({ state: "reviewed", reviewedBy: B });
    expect(done.lastReviewedAt).not.toBeNull();
    expect(await code(repo.review(r.id, 1, B))).toBe("not_reviewable");
    await expect(app.query("UPDATE private.locations SET reviewed_by = proposed_by WHERE id = $1", [r.id])).rejects.toMatchObject({ code: "23514" });
  });

  it("changing a reviewed geometry sends it back to candidate and clears the reviewer, so it needs a new review", async () => {
    const r = await repo.create(base(), A);
    await repo.review(r.id, 1, B);
    const changed = await repo.proposeChange(r.id, 1, pt(10.7, 10.7), prov, A);
    expect(changed).toMatchObject({ state: "candidate", reviewedBy: null, lastReviewedAt: null, revision: 2 });
    expect(await code(repo.review(r.id, 1, B))).toBe("stale");
    expect((await repo.review(r.id, 2, B)).state).toBe("reviewed");
  });

  it("lists by study area in stable id order with a cursor, and an unknown or malformed id is simply not found", async () => {
    for (let i = 0; i < 3; i++) await repo.create(base({ geometry: pt(10.1 + i / 10, 10.5) }), A);
    const p1 = await repo.list(AREA, 2, null);
    const p2 = await repo.list(AREA, 2, p1[1]!.id);
    expect([...p1, ...p2].map((x) => x.id)).toEqual([...p1, ...p2].map((x) => x.id).sort());
    expect(new Set([...p1, ...p2].map((x) => x.id)).size).toBe(3);
    expect(await repo.get("not-a-uuid")).toBeNull();
    expect(await repo.list("00000000-0000-4000-8000-0000000000a9", 5, null)).toEqual([]);
  });

  it("the private API role cannot rewrite revision history or delete places' audit", async () => {
    const r = await repo.create(base(), A);
    await expect(app.query("UPDATE audit.location_geometry_revisions SET changed_by = NULL WHERE location_id = $1", [r.id])).rejects.toMatchObject({ code: "42501" });
    await expect(app.query("DELETE FROM audit.location_geometry_revisions WHERE location_id = $1", [r.id])).rejects.toMatchObject({ code: "42501" });
  });

  it("the public API role can neither read private places nor their revision history", async () => {
    await repo.create(base(), A);
    const pub = new pg.Client({ connectionString: url }); await pub.connect(); await pub.query("SET ROLE makarba_public_api");
    await expect(pub.query("SELECT * FROM private.locations")).rejects.toMatchObject({ code: "42501" });
    await expect(pub.query("SELECT * FROM audit.location_geometry_revisions")).rejects.toMatchObject({ code: "42501" });
    await pub.end();
  });
});
