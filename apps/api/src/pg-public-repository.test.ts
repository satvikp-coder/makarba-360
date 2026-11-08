import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { createApp } from "./app.js";
import { PgPublicRepository } from "./pg-public-repository.js";
import { publicApi } from "./public-api.js";
import { runConformance, summarize } from "./public-conformance.js";
import { notFound, safeErrors } from "./safe-errors.js";

// Database-backed (CI `database` job, real PostGIS). Skipped locally without TEST_DATABASE_URL. Fixtures are the synthetic bundle only.
const url = process.env["TEST_DATABASE_URL"];
const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const bundle = JSON.parse(readFileSync(root("docs/project/contracts/fixture-bundle.json"), "utf8"));
const bootstrap = readFileSync(root("db/bootstrap/001_roles_and_schemas.sql"), "utf8");

describe.skipIf(!url)("PgPublicRepository on PostGIS [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, reader: pg.Client, base = "";
  const servers: Server[] = [];

  async function seed() {
    await admin.query("SET ROLE makarba_worker");
    for (const f of bundle.locations.features) {
      await admin.query(
        `INSERT INTO published.locations (id, slug, category_id, name, geometry, last_reviewed_at, revision, snapshot_id)
         VALUES ($1, $2, $3, $4::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), now(), 1, 'synthetic-seed')`,
        [f.id, f.properties.slug, f.properties.category, JSON.stringify(f.properties.name), JSON.stringify(f.geometry)],
      );
    }
    await admin.query("INSERT INTO published.history (slug, payload, revision, snapshot_id) VALUES ('synthetic-point', $1::jsonb, 1, 'synthetic-seed')", [JSON.stringify(bundle.history)]);
    await admin.query("INSERT INTO published.media (id, location_id, payload, revision, snapshot_id) VALUES ('synthetic-media-1', $1, $2::jsonb, 1, 'synthetic-seed')", [bundle.media.locationId, JSON.stringify(bundle.media)]);
    await admin.query("INSERT INTO published.insights_snapshots (id, is_current, payload) VALUES ('s1', true, $1::jsonb)", [JSON.stringify(bundle.insights)]);
    await admin.query("RESET ROLE");
  }

  async function start(repo: PgPublicRepository) {
    const app = createApp();
    app.use("/api/v1/public", publicApi({ repository: repo }));
    app.use(notFound); app.use(safeErrors);
    const s = await new Promise<Server>((resolve) => { const sv = app.listen(0, "127.0.0.1", () => resolve(sv)); });
    servers.push(s);
    return `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/v1/public`;
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url }); await admin.connect();
    reader = new pg.Client({ connectionString: url }); await reader.connect();
  });
  afterAll(async () => { servers.forEach((s) => s.close()); await admin.end(); await reader.end(); });
  beforeEach(async () => {
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    await seed();
    await reader.query("RESET ROLE");
    await reader.query("SET ROLE makarba_public_api");          // the API's real runtime role: it can read `published` and nothing else
    base = await start(new PgPublicRepository(reader));
  });

  it("the shared 11-check conformance suite passes against the database-backed router", async () => {
    const res = await runConformance(base);
    expect(summarize(res).failed, JSON.stringify(summarize(res).failed)).toEqual([]);
  });

  it("runs as the read-only public role: it cannot read private tables or write the projection", async () => {
    await expect(reader.query("SELECT * FROM private.locations")).rejects.toMatchObject({ code: "42501" });
    await expect(reader.query("DELETE FROM published.history")).rejects.toMatchObject({ code: "42501" });
  });

  it("a withdrawn (deleted) place answers 404 at once, disappears from the list and takes its history and media with it", async () => {
    expect((await fetch(`${base}/locations/synthetic-point/history`)).status).toBe(200);
    await admin.query("SET ROLE makarba_worker"); await admin.query("DELETE FROM published.locations WHERE slug = 'synthetic-point'"); await admin.query("RESET ROLE");
    const gone = await fetch(`${base}/locations/synthetic-point/history`);
    const unknown = await fetch(`${base}/locations/never-existed/history`);
    expect([gone.status, await gone.json()]).toEqual([unknown.status, await unknown.json()]);
    expect((await fetch(`${base}/media/synthetic-media-1`)).status).toBe(404);
    const list = (await (await fetch(`${base}/locations`)).json()) as { features: { properties: { slug: string } }[] };
    expect(list.features.map((f) => f.properties.slug)).not.toContain("synthetic-point");
  });

  it("pagination is stable and complete: pages of one cover every place exactly once, ordered by id", async () => {
    const seen: string[] = []; let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const r = (await (await fetch(`${base}/locations?limit=1${cursor ? `&cursor=${cursor}` : ""}`)).json()) as { features: { id: string }[]; page: { nextCursor: string | null } };
      seen.push(...r.features.map((f) => f.id));
      cursor = r.page.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual([...seen].sort());
    expect(new Set(seen).size).toBe(bundle.locations.features.length);
  });

  it("a snapshot that is not marked current is never served; with none current the answer is an empty valid snapshot, not invented numbers", async () => {
    await admin.query("SET ROLE makarba_worker"); await admin.query("UPDATE published.insights_snapshots SET is_current = false"); await admin.query("RESET ROLE");
    const body = (await (await fetch(`${base}/insights`)).json()) as { cohorts: unknown[]; sampleNote: string };
    expect(body.cohorts).toEqual([]);
    expect(body.sampleNote).toMatch(/No results have been published/);
  });

  it("only one snapshot can be current at a time", async () => {
    await expect(admin.query("INSERT INTO published.insights_snapshots (id, is_current, payload) VALUES ('s2', true, '{}'::jsonb)")).rejects.toMatchObject({ code: "23505" });
  });

  it("the contract guard still blocks a bad row: a restricted field in a stored payload is refused with a generic 500", async () => {
    await admin.query("SET ROLE makarba_worker");
    await admin.query("UPDATE published.history SET payload = payload || '{\"interviewLatitude\": 10.1}'::jsonb WHERE slug = 'synthetic-point'");
    await admin.query("RESET ROLE");
    const res = await fetch(`${base}/locations/synthetic-point/history`);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("interviewLatitude");
  });
  it("the database-backed API accepts no writes", async () => {
    for (const m of ["POST", "PUT", "DELETE"]) expect((await fetch(`${base}/locations`, { method: m })).status, m).toBeGreaterThanOrEqual(400);
  });
});
