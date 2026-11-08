import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";
import { publicApi, type PublicRepository } from "./public-api.js";
import { runConformance, summarize } from "./public-conformance.js";
import { notFound, safeErrors } from "./safe-errors.js";
import { syntheticRepository } from "./synthetic-repository.js";

function serve(mount: (app: express.Express) => void): Promise<{ server: Server; base: string }> {
  const app = createApp();
  mount(app);
  app.use(notFound);
  app.use(safeErrors);
  return new Promise((resolve) => { const server = app.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/public` })); });
}
const open: Server[] = [];
afterAll(() => { open.forEach((s) => s.close()); });
const start = async (mount: (app: express.Express) => void) => { const r = await serve(mount); open.push(r.server); return r.base; };

describe("one conformance suite, two implementations", () => {
  let mockBase = "", repoBase = "";
  beforeAll(async () => {
    mockBase = await start((a) => a.use("/api/v1/public", mockRouter()));
    repoBase = await start((a) => a.use("/api/v1/public", publicApi({ repository: syntheticRepository() })));
  });
  it("the synthetic mock passes every check [PASS - MOCK]", async () => {
    const checks = await runConformance(mockBase);
    expect(summarize(checks).failed, JSON.stringify(summarize(checks).failed)).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(10);
  });
  it("the repository-backed router passes every check [PASS - SYNTHETIC REPOSITORY]", async () => {
    const checks = await runConformance(repoBase);
    expect(summarize(checks).failed, JSON.stringify(summarize(checks).failed)).toEqual([]);
  });
  it("the suite really fails an implementation that leaks: a repository returning a private field is refused with a generic 500", async () => {
    const leaky: PublicRepository = { ...syntheticRepository(), listLocations: async () => ({ type: "FeatureCollection", features: [{ interviewLatitude: 10 }], page: { limit: 1, nextCursor: null }, meta: {} }) };
    const base = await start((a) => a.use("/api/v1/public", publicApi({ repository: leaky })));
    const res = await fetch(`${base}/locations`);
    expect(res.status).toBe(500);
    const t = await res.text();
    expect(t).not.toContain("interviewLatitude");
    expect(JSON.parse(t).code).toBe("CONTRACT_VIOLATION");
    const failed = summarize(await runConformance(base)).failed.map((c) => c.id);
    expect(failed.length).toBeGreaterThan(0);
  });
});

describe("repository-backed router behaviour", () => {
  it("withdrawal: after a place is unpublished the next request is the same 404 as an unknown place, and the list no longer has it", async () => {
    const repo = syntheticRepository();
    const base = await start((a) => a.use("/api/v1/public", publicApi({ repository: repo })));
    expect((await fetch(`${base}/locations/synthetic-point/history`)).status).toBe(200);
    repo.unpublish("synthetic-point");
    const gone = await fetch(`${base}/locations/synthetic-point/history`);
    const unknown = await fetch(`${base}/locations/never-existed/history`);
    expect([gone.status, await gone.json()]).toEqual([unknown.status, await unknown.json()]);
    const list = await (await fetch(`${base}/locations`)).json() as { features: { properties: { slug: string } }[] };
    expect(list.features.map((f) => f.properties.slug)).not.toContain("synthetic-point");
    expect(gone.headers.get("cache-control")).toMatch(/no-store/);
  });
  it("a failing or hanging repository gives a retryable 503 with no internal text; the timeout is enforced", async () => {
    const boom: PublicRepository = { ...syntheticRepository(), getHistory: async () => { throw new Error("password=hunter2 at /srv/db.ts:12"); }, listLocations: () => new Promise(() => {}) };
    const base = await start((a) => a.use("/api/v1/public", publicApi({ repository: boom, repositoryTimeoutMs: 50 })));
    for (const p of ["/locations/synthetic-point/history", "/locations"]) {
      const res = await fetch(`${base}${p}`);
      const text = await res.text();
      expect(res.status, p).toBe(503);
      expect(JSON.parse(text)).toMatchObject({ code: "UNAVAILABLE", retryable: true });
      expect(text).not.toMatch(/hunter2|db\.ts/);
    }
  });
  it("stories: 404 until the repository offers them, then contract-shaped, then 404 again after withdrawal", async () => {
    const without = await start((a) => a.use("/api/v1/public", publicApi({ repository: syntheticRepository() })));
    expect((await fetch(`${without}/stories`)).status).toBe(404);
    const repo = syntheticRepository({ withStories: true });
    const base = await start((a) => a.use("/api/v1/public", publicApi({ repository: repo })));
    const ok = await fetch(`${base}/stories`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { stories: unknown[] }).stories).toHaveLength(1);
    repo.withdrawStories();
    expect((await fetch(`${base}/stories`)).status).toBe(404);
  });
  it("pagination input is validated: cursor must be opaque URL-safe text, limit is bounded", async () => {
    const base = await start((a) => a.use("/api/v1/public", publicApi({ repository: syntheticRepository() })));
    expect((await fetch(`${base}/locations?cursor=%27%3B--`)).status).toBe(422);
    expect((await fetch(`${base}/locations?limit=200&cursor=abc_DEF-123`)).status).toBe(200);
    expect((await fetch(`${base}/locations?limit=201`)).status).toBe(422);
  });
});
