import request from "supertest";
import { describe, expect, it } from "vitest";
import { validatePublic } from "@makarba/contracts";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";

const app = createApp();
app.use("/api/v1/public", mockRouter());
const get = (p: string) => request(app).get("/api/v1/public" + p);

describe("synthetic mock public API", () => {
  it("serves contract-valid success responses with no-store", async () => {
    for (const [path, kind] of [["/locations", "locations"], ["/insights", "insights"], ["/locations/synthetic-point/history", "history"], ["/media/synthetic-media-1", "media"]] as const) {
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
    expect(s.body.cohorts.every((c: { suppressed: boolean; n: number | null }) => c.suppressed && c.n === null)).toBe(true);
    const e = await get("/locations?scenario=error");
    expect(e.status).toBe(503);
    expect(e.body.retryable).toBe(true);
  });
  it("returns safe 404/422 errors", async () => {
    expect((await get("/media/other")).status).toBe(404);
    expect((await get("/locations/unknown/history")).status).toBe(404);
    expect((await get("/locations?limit=999")).status).toBe(422);
    expect((await get("/insights?cohort=bogus")).status).toBe(422);
    expect((await get("/locations?scenario=bogus")).status).toBe(422);
  });
  it("never exposes restricted fields in any response", async () => {
    for (const p of ["/locations", "/insights", "/locations/synthetic-point/history", "/media/synthetic-media-1"]) {
      expect(JSON.stringify((await get(p)).body).toLowerCase()).not.toMatch(/interviewlatitude|researcherid|rawanswers|originalkey/);
    }
  });
});
