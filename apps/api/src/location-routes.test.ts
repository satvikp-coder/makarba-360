import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemorySessionStore, SessionService } from "@makarba/auth";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { LocationRepoError, type LocationRecord, type LocationRepository, type NewLocation } from "./location-repository.js";
import { locationRoutes } from "./location-routes.js";
import { privateApi, validateRoutes } from "./private-routes.js";

const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";
const authz = new Authorizer(loadMatrix());
const grant = (role: string, area: string) => ({ role, studyAreaId: area, expiresAt: null }) as Principal["grants"][number];
const people: Record<string, Principal> = {
  r1: { userId: "r1", active: true, grants: [grant("researcher", S1)] },
  r2: { userId: "r2", active: true, grants: [grant("researcher", S1)] },
  lead1: { userId: "lead1", active: true, grants: [grant("lead", S1)] },
  lead2: { userId: "lead2", active: true, grants: [grant("lead", S2)] },
  both: { userId: "both", active: true, grants: [grant("researcher", S1), grant("lead", S1)] },
  gone: { userId: "gone", active: false, grants: [grant("researcher", S1)] },
};

/** In-memory repository with the same error semantics as the PostGIS one (which has its own database tests). */
class MemRepo implements LocationRepository {
  rows = new Map<string, LocationRecord>(); n = 0; revs: string[] = [];
  async create(i: NewLocation, actor: string) {
    const id = `00000000-0000-4000-8000-${String(++this.n).padStart(12, "0")}`;
    const r: LocationRecord = { id, studyAreaId: i.studyAreaId, categoryId: i.categoryId, name: i.name, geometry: i.geometry, provenance: i.provenance, revision: 1, state: "candidate", proposedBy: actor, reviewedBy: null, lastReviewedAt: null };
    this.rows.set(id, r); return r;
  }
  async get(id: string) { return this.rows.get(id) ?? null; }
  async list(area: string) { return [...this.rows.values()].filter((r) => r.studyAreaId === area); }
  async proposeChange(id: string, rev: number, geometry: unknown, provenance: never, actor: string) {
    const r = this.rows.get(id); if (!r) throw new LocationRepoError("not_found");
    if (r.revision !== rev) throw new LocationRepoError("stale", r.revision);
    if (JSON.stringify(r.geometry) === JSON.stringify(geometry) && JSON.stringify(r.provenance) === JSON.stringify(provenance)) throw new LocationRepoError("unchanged", r.revision);
    const next = { ...r, geometry, provenance, revision: r.revision + 1, proposedBy: actor, state: "candidate", reviewedBy: null }; this.rows.set(id, next); return next;
  }
  async review(id: string, rev: number, reviewer: string) {
    const r = this.rows.get(id); if (!r) throw new LocationRepoError("not_found");
    if (r.revision !== rev) throw new LocationRepoError("stale", r.revision);
    if (r.proposedBy === reviewer) throw new LocationRepoError("own_work");
    if (r.state !== "candidate") throw new LocationRepoError("not_reviewable");
    const next = { ...r, state: "reviewed", reviewedBy: reviewer, lastReviewedAt: "2026-01-01T00:00:00.000Z" }; this.rows.set(id, next); return next;
  }
  async revisions() { return []; }
}

async function world(user?: string) {
  const repo = new MemRepo();
  const sessions = new SessionService({ store: new MemorySessionStore() });
  const app = express(); app.use(express.json());
  const routes = locationRoutes(repo);
  expect(validateRoutes(authz, routes)).toEqual([]);
  app.use("/private", privateApi({ authz, principals: { loadPrincipal: async (id) => people[id] ?? null }, sessions, routes }));
  const as = async (u: string) => { const { token, csrfToken } = await sessions.create(u, true); return { cookie: `mk_session=${token}`, csrf: csrfToken }; };
  void user;
  return { app, repo, as };
}
const body = (over: Record<string, unknown> = {}) => ({
  studyAreaId: S1, studyAreaVersion: 1, categoryId: "heritage", name: { en: "Synthetic well" }, crs: "EPSG:4326",
  geometry: { type: "Point", coordinates: [10.5, 10.5] }, provenance: { source: "synthetic exercise", method: "digitised" }, ...over,
});
type W = Awaited<ReturnType<typeof world>>;
const post = async (w: W, u: string, path: string, b: object, method: "post" | "put" = "post") => { const s = await w.as(u); return request(w.app)[method](`/private${path}`).set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf).send(b); };
const get = async (w: W, u: string, path: string) => { const s = await w.as(u); return request(w.app).get(`/private${path}`).set("Cookie", s.cookie); };

describe("location geometry routes", () => {
  it("every route names a capability that exists in the matrix", () => {
    expect(locationRoutes(new MemRepo()).map((r) => r.action).sort()).toEqual(["location.propose_geometry", "location.propose_geometry", "location.review_geometry", "location.review_geometry", "location.review_geometry", "location.review_geometry"].sort());
  });

  it("an assigned researcher creates a candidate; the author is the session user, never a body field", async () => {
    const w = await world();
    const res = await post(w, "r1", "/locations", body({ proposedBy: "someone-else", state: "published", revision: 9 }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ state: "candidate", revision: 1, proposedBy: "r1", geometry: { type: "Point" } });
  });

  it("rejects empty, self-intersecting, mislabelled-CRS and provenance-less geometry with field errors", async () => {
    const w = await world();
    const bow = { type: "Polygon", coordinates: [[[10, 10], [11, 11], [11, 10], [10, 11], [10, 10]]] };
    for (const [over, re] of [
      [{ geometry: { type: "LineString", coordinates: [] } }, /./],
      [{ geometry: bow }, /crosses itself/],
      [{ crs: "EPSG:3857" }, /not WGS 84/],
      [{ crs: undefined }, /crs is required/],
      [{ geometry: { type: "Point", coordinates: [1_113_194, 1_118_889] } }, /outside longitude/],
      [{ provenance: undefined }, /provenance is required/],
      [{ geometry: { type: "GeometryCollection", coordinates: [] } }, /not allowed/],
    ] as const) {
      const res = await post(w, "r1", "/locations", body(over));
      expect(res.status, JSON.stringify(over)).toBe(422);
      expect(res.body.fieldErrors.geometry).toMatch(re);
    }
    expect(w.repo.rows.size).toBe(0);
  });

  it("requires a session, a CSRF token, an active user and a grant for the study area", async () => {
    const w = await world();
    expect((await request(w.app).post("/private/locations").send(body())).status).toBe(401);
    const s = await w.as("r1");
    expect((await request(w.app).post("/private/locations").set("Cookie", s.cookie).send(body())).status).toBe(403);
    expect((await post(w, "gone", "/locations", body())).status).toBe(403);
    expect((await post(w, "r1", "/locations", body({ studyAreaId: S2 }))).status).toBe(403);
    expect((await post(w, "r1", "/locations", body({ studyAreaId: "not-a-uuid" }))).status).toBe(403);
    expect((await post(w, "lead1", "/locations", body())).status).toBe(403);       // leads review; they do not propose
    expect(w.repo.rows.size).toBe(0);
  });

  it("only the owner researcher can change a geometry; stale and unchanged submissions are 409 with the current revision", async () => {
    const w = await world();
    const id = (await post(w, "r1", "/locations", body())).body.id as string;
    const moved = { crs: "EPSG:4326", geometry: { type: "Point", coordinates: [10.6, 10.5] }, provenance: { source: "resurvey", method: "surveyed" } };
    expect((await post(w, "r2", `/locations/${id}/geometry`, { ...moved, expectedRevision: 1 }, "put")).status).toBe(403);
    const ok = await post(w, "r1", `/locations/${id}/geometry`, { ...moved, expectedRevision: 1 }, "put");
    expect(ok.status).toBe(200); expect(ok.body.revision).toBe(2);
    const stale = await post(w, "r1", `/locations/${id}/geometry`, { ...moved, expectedRevision: 1 }, "put");
    expect(stale.status).toBe(409); expect(stale.body).toMatchObject({ code: "stale_revision", currentRevision: 2 });
    const same = await post(w, "r1", `/locations/${id}/geometry`, { ...moved, expectedRevision: 2 }, "put");
    expect(same.status).toBe(409); expect(same.body.code).toBe("unchanged");
    expect((await post(w, "r1", `/locations/${id}/geometry`, { ...moved, geometry: { type: "Point", coordinates: [200, 0] }, expectedRevision: 2 }, "put")).status).toBe(422);
    expect((await post(w, "r1", `/locations/${id}/geometry`, { ...moved, expectedRevision: "2" }, "put")).status).toBe(422);
  });

  it("only a lead of the same study area can read, list and review; an unknown id is indistinguishable from a forbidden one", async () => {
    const w = await world();
    const id = (await post(w, "r1", "/locations", body())).body.id as string;
    expect((await get(w, "r1", `/locations/${id}`)).status).toBe(403);
    expect((await get(w, "lead2", `/locations/${id}`)).status).toBe(403);
    expect((await get(w, "lead1", `/locations/${id}`)).status).toBe(200);
    expect((await get(w, "lead1", "/locations/00000000-0000-4000-8000-00000000ffff")).status).toBe(403);
    expect((await get(w, "lead1", `/locations?studyAreaId=${S1}`)).body.items).toHaveLength(1);
    expect((await get(w, "lead1", `/locations?studyAreaId=${S2}`)).status).toBe(403);
    expect((await get(w, "lead1", "/locations")).status).toBe(403);
    expect((await post(w, "r1", `/locations/${id}/review`, { expectedRevision: 1 })).status).toBe(403);
  });

  it("an independent reviewer reviews once; a person cannot review their own geometry; stale review is refused", async () => {
    const w = await world();
    const mine = (await post(w, "both", "/locations", body())).body.id as string;
    const own = await post(w, "both", `/locations/${mine}/review`, { expectedRevision: 1 });
    expect(own.status).toBe(409); expect(own.body.code).toBe("own_work");
    const id = (await post(w, "r1", "/locations", body())).body.id as string;
    expect((await post(w, "lead1", `/locations/${id}/review`, { expectedRevision: 7 })).body.code).toBe("stale_revision");
    const done = await post(w, "lead1", `/locations/${id}/review`, { expectedRevision: 1 });
    expect(done.status).toBe(200); expect(done.body).toMatchObject({ state: "reviewed", reviewedBy: "lead1" });
    expect((await post(w, "lead1", `/locations/${id}/review`, { expectedRevision: 1 })).body.code).toBe("not_reviewable");
  });

  it("errors never echo stack traces or SQL", async () => {
    const w = await world();
    w.repo.create = async () => { throw new Error("password authentication failed for user makarba_private_api at 10.0.0.5"); };
    const app = express(); app.use(express.json());
    const sessions = new SessionService({ store: new MemorySessionStore() });
    app.use("/private", privateApi({ authz, principals: { loadPrincipal: async (id) => people[id] ?? null }, sessions, routes: locationRoutes(w.repo) }));
    app.use((_e: unknown, _q: unknown, res: express.Response, _n: unknown) => { void _n; res.status(500).json({ code: "internal_error" }); });
    const { token, csrfToken } = await sessions.create("r1", true);
    const res = await request(app).post("/private/locations").set("Cookie", `mk_session=${token}`).set("X-CSRF-Token", csrfToken).send(body());
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/password|10\.0\.0\.5|makarba_private_api/);
  });
});
