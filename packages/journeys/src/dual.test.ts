import { describe, expect, it } from "vitest";
import { runJourney } from "./acceptance.js";
import { configFromEnv, LiveAdapter, preflight, REQUIRED_SERVICES } from "./live-adapter.js";
import { SyntheticAdapter } from "./synthetic-adapter.js";

describe("MODE 1: synthetic composition [PASS - MOCK/MODEL]", () => {
  it("the full field -> review -> public -> withdrawal journey satisfies the acceptance assertions", async () => {
    await runJourney(new SyntheticAdapter());
  });
  it("is repeatable on one adapter instance (reset between runs)", async () => {
    const a = new SyntheticAdapter();
    await runJourney(a);
    await runJourney(a);
  });
});

describe("preflight never reports a pass for services that are missing", () => {
  const cfg = { privateBase: "http://x/private", publicBase: "http://x/api/v1/public", auth: {} };
  it("nothing reachable: every required service and identity is listed as missing", async () => {
    const down = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const p = await preflight({ ...cfg, fetcher: down });
    expect(p.ok).toBe(false);
    expect(p.missing.map((m) => m.id)).toEqual(expect.arrayContaining([...REQUIRED_SERVICES.map((s) => s.id), "public-insights", "auth-lead", "auth-administrator", "auth-researcher"]));
  });
  it("routes answering 404 are missing; routes answering 401 exist", async () => {
    const half = (async (u: string) => new Response("{}", { status: /interviews\/preflight-probe\/approve|\/test\/reset/.test(u) ? 401 : /insights/.test(u) ? 200 : 404 })) as unknown as typeof fetch;
    const auth = { lead: { cookie: "c", csrf: "t" }, administrator: { cookie: "c", csrf: "t" }, researcher: { cookie: "c", csrf: "t" } };
    const p = await preflight({ ...cfg, auth, fetcher: half });
    expect(p.missing.map((m) => m.id).sort()).toEqual(["interview-submit", "interview-withdraw", "publication-run"].sort());
  });
  it("a complete environment passes preflight", async () => {
    const all = (async (u: string) => new Response("{}", { status: /insights/.test(u) ? 200 : 403 })) as unknown as typeof fetch;
    const auth = { lead: { cookie: "c", csrf: "t" }, administrator: { cookie: "c", csrf: "t" }, researcher: { cookie: "c", csrf: "t" } };
    expect(await preflight({ ...cfg, auth, fetcher: all })).toEqual({ ok: true, missing: [] });
  });
});

const live = configFromEnv(process.env);
describe.skipIf(!live)("MODE 2: live environment with synthetic seed data [runs only when LIVE_API_BASE is set]", () => {
  it("preflight: every required service exists (otherwise the run fails with the list)", async () => {
    const p = await preflight(live!);
    expect(p.missing, "MISSING SERVICES - the journey cannot run").toEqual([]);
  });
  it("the same acceptance assertions pass against the live environment", async () => {
    await runJourney(new LiveAdapter(live!));
  });
});
describe.skipIf(!!live)("MODE 2 status", () => {
  it("[BLOCKED - LIVE SERVICE MISSING] no LIVE_API_BASE configured: live journey not run", () => {
    expect(process.env["LIVE_API_BASE"]).toBeUndefined();
  });
});
