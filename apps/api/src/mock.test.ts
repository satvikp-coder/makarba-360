import request from "supertest";
import { describe, expect, it } from "vitest";
import { findForbiddenField, validatePublic } from "@makarba/contracts";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";
import { demoSlugs } from "./demo-makarba.js";

const app = createApp();
app.use("/api/v1/public", mockRouter());
const get = (p: string) => request(app).get("/api/v1/public" + p);
const FIRST_SLUG = "junction-fruit-carts";

// Bounding box of the illustrative Makarba demo area (the brief: roughly 22.975-23.005 N, 72.49-72.52 E).
const BOX = { w: 72.49, s: 22.975, e: 72.52, n: 23.005 };
function positions(c: unknown): [number, number][] {
  if (Array.isArray(c) && typeof c[0] === "number") return [c as [number, number]];
  return Array.isArray(c) ? c.flatMap(positions) : [];
}

describe("synthetic mock public API (illustrative Makarba demo data)", () => {
  it("serves contract-valid success responses with no-store", async () => {
    for (const [path, kind] of [["/locations", "locations"], ["/insights", "insights"], [`/locations/${FIRST_SLUG}/history`, "history"], ["/media/synthetic-media-1", "media"]] as const) {
      const r = await get(path);
      expect(r.status).toBe(200);
      expect(validatePublic(kind, r.body)).toEqual({ ok: true });
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(r.body.meta.datasetKind).toBe("synthetic");
    }
  });
  it("serves empty, suppressed and transient-error states", async () => {
    expect((await get("/locations?scenario=empty")).body.features).toEqual([]);
    const s = await get("/insights?scenario=suppressed");
    expect(s.body.cohorts.length).toBeGreaterThan(0);
    expect(s.body.cohorts.every((c: { suppressed: boolean; n: number | null }) => c.suppressed && c.n === null)).toBe(true);
    const e = await get("/locations?scenario=error");
    expect(e.status).toBe(503);
    expect(e.body.retryable).toBe(true);
  });
  it("returns safe 404/422 errors", async () => {
    expect((await get("/media/other")).status).toBe(404);
    expect((await get("/locations/unknown/history")).status).toBe(404);
    expect((await get("/locations/synthetic-point/history")).status).toBe(404);
    expect((await get("/locations?limit=999")).status).toBe(422);
    expect((await get("/insights?cohort=bogus")).status).toBe(422);
    expect((await get("/insights?cohort=demo-weekend-visitors")).status).toBe(200);
    expect((await get("/locations?scenario=bogus")).status).toBe(422);
  });
  it("never exposes restricted fields in any response", async () => {
    for (const p of ["/locations", "/insights", `/locations/${FIRST_SLUG}/history`, "/media/synthetic-media-1", "/stories"]) {
      const body = (await get(p)).body;
      expect(JSON.stringify(body).toLowerCase()).not.toMatch(/interviewlatitude|researcherid|rawanswers|originalkey/);
      expect(findForbiddenField(body)).toBeNull();
    }
  });
});

describe("illustrative Makarba demo dataset", () => {
  it("places at least ten published places, every coordinate inside the Makarba demo box", async () => {
    const { body } = await get("/locations");
    expect(body.features.length).toBeGreaterThanOrEqual(10);
    for (const f of body.features) {
      for (const [lon, lat] of positions(f.geometry.coordinates)) {
        expect(lon, f.properties.slug).toBeGreaterThanOrEqual(BOX.w);
        expect(lon, f.properties.slug).toBeLessThanOrEqual(BOX.e);
        expect(lat, f.properties.slug).toBeGreaterThanOrEqual(BOX.s);
        expect(lat, f.properties.slug).toBeLessThanOrEqual(BOX.n);
      }
    }
    // the old off-site [10,10] synthetic point is no longer served
    expect(JSON.stringify(body)).not.toContain("[10,10]");
    expect(new Set(body.features.map((f: { geometry: { type: string } }) => f.geometry.type))).toEqual(new Set(["Point", "MultiLineString", "MultiPolygon"]));
  });
  it("every place has a contract-valid history whose every event is labelled illustrative", async () => {
    expect(demoSlugs.length).toBeGreaterThanOrEqual(10);
    for (const slug of demoSlugs) {
      const r = await get(`/locations/${slug}/history`);
      expect(r.status, slug).toBe(200);
      expect(validatePublic("history", r.body), slug).toEqual({ ok: true });
      expect(r.body.events.length, slug).toBeGreaterThan(0);
      for (const e of r.body.events) expect(e.text, slug).toMatch(/^Illustrative/);
      for (const s of r.body.sources) expect(s.citation).toMatch(/Illustrative demo note: fictional/);
    }
  });
  it("insights: ready groups meet k5 and denominators; the hidden group carries no counts (never zero)", async () => {
    const { body } = await get("/insights");
    expect(body.sampleNote).toMatch(/ILLUSTRATIVE DEMO/);
    const hidden = body.cohorts.filter((c: { suppressed: boolean }) => c.suppressed);
    expect(hidden.length).toBe(1);
    expect(hidden[0]).toMatchObject({ n: null, validAnswerN: null, missingN: null, unsureN: null, ratings: [], issues: [] });
    for (const c of body.cohorts.filter((x: { suppressed: boolean }) => !x.suppressed)) expect(c.n).toBeGreaterThanOrEqual(5);
  });
  it("stories are fictional composites, attributed as such, with no private fields", async () => {
    const r = await get("/stories");
    expect(r.status).toBe(200);
    expect(r.body.meta.datasetKind).toBe("synthetic");
    for (const s of r.body.stories) {
      expect(s.title).toMatch(/^Illustrative/);
      for (const b of s.blocks) expect(b.attribution).toMatch(/fictional composite/);
    }
    expect((await get("/stories?scenario=empty")).body.stories).toEqual([]);
  });
  it("is read-only: the public mock accepts no submissions", async () => {
    for (const p of ["/locations", "/stories", "/insights"]) {
      const r = await request(app).post("/api/v1/public" + p).send({ answers: [1] });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    }
  });
});
