import type { Actor, CaptureInput, Captured, JourneyAdapter } from "./adapter.js";

/**
 * Live mode (#113). Talks to a real environment seeded with SYNTHETIC data only. The endpoints below are a PROPOSED private journey
 * API; Developer A may rename them, but must keep the behaviour the acceptance assertions rely on (see DEVELOPER_B_INTEGRATION_HANDOFF.md).
 * Nothing here is faked: if a service is missing, `preflight` says exactly which, and the run fails instead of passing.
 */
export const REQUIRED_SERVICES = [
  { id: "test-reset", method: "POST", path: "/private/test/reset", why: "empties synthetic data in a TEST environment only (must refuse in production)" },
  { id: "interview-submit", method: "POST", path: "/private/interviews", why: "stores a consented interview with its private position and subject places (issues #37, #38)" },
  { id: "interview-approve", method: "POST", path: "/private/interviews/:id/approve", why: "independent review decision (issues #35, #99)" },
  { id: "interview-withdraw", method: "POST", path: "/private/interviews/:id/withdraw", why: "withdrawal propagation (issue #105)" },
  { id: "publication-run", method: "POST", path: "/private/publication/run", why: "aggregation, disclosure and snapshot publication (issues #84, #92, #103)" },
] as const;
export const PUBLIC_REQUIRED = [{ id: "public-insights", path: "/insights?cohort=lake-B", why: "public projection API (issue #81)" }] as const;

export interface Auth { cookie: string; csrf: string }
export interface LiveConfig { privateBase: string; publicBase: string; auth: Partial<Record<Actor, Auth>>; fetcher?: typeof fetch }

export interface Preflight { ok: boolean; missing: { id: string; why: string; detail: string }[] }

/** A private route exists if an unauthenticated call is refused with 401/403; 404/405/connection errors mean it is missing. */
export async function preflight(cfg: LiveConfig): Promise<Preflight> {
  const f = cfg.fetcher ?? fetch;
  const missing: Preflight["missing"] = [];
  for (const s of REQUIRED_SERVICES) {
    try {
      const res = await f(cfg.privateBase + s.path.replace(":id", "preflight-probe"), { method: s.method, redirect: "manual" });
      if (res.status !== 401 && res.status !== 403) missing.push({ id: s.id, why: s.why, detail: `unauthenticated ${s.method} answered ${res.status} (expected 401 or 403)` });
    } catch (e) { missing.push({ id: s.id, why: s.why, detail: `unreachable: ${(e as Error).message}` }); }
  }
  for (const p of PUBLIC_REQUIRED) {
    try {
      const res = await f(cfg.publicBase + p.path);
      if (res.status !== 200) missing.push({ id: p.id, why: p.why, detail: `GET answered ${res.status} (expected 200)` });
    } catch (e) { missing.push({ id: p.id, why: p.why, detail: `unreachable: ${(e as Error).message}` }); }
  }
  for (const a of ["lead", "administrator", "researcher"] as const) if (!cfg.auth[a]) missing.push({ id: `auth-${a}`, why: "test identity for the journey", detail: `no session configured for ${a} (LIVE_AUTH_JSON)` });
  return { ok: missing.length === 0, missing };
}

export function configFromEnv(env: NodeJS.ProcessEnv): LiveConfig | null {
  if (!env["LIVE_API_BASE"]) return null;
  return { privateBase: env["LIVE_API_BASE"] + "/private", publicBase: env["LIVE_API_BASE"] + "/api/v1/public", auth: env["LIVE_AUTH_JSON"] ? JSON.parse(env["LIVE_AUTH_JSON"]) : {} };
}

export class LiveAdapter implements JourneyAdapter {
  readonly mode = "live" as const;
  constructor(private cfg: LiveConfig) {}
  private get f(): typeof fetch { return this.cfg.fetcher ?? fetch; }
  private async call(as: Actor, method: string, path: string, body?: unknown) {
    const a = this.cfg.auth[as];
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (a) { headers["cookie"] = a.cookie; headers["x-csrf-token"] = a.csrf; }
    return this.f(this.cfg.privateBase + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async reset() { const r = await this.call("lead", "POST", "/test/reset"); if (!r.ok) throw new Error(`reset failed: ${r.status}`); }
  async capture(i: CaptureInput): Promise<Captured> {
    const r = await this.call("researcher", "POST", "/interviews", { seq: i.seq, consent: i.consent, heldAt: i.heldAt, discussed: i.discussed, rating: i.rating ?? null, reason: i.reason ?? "answered" });
    if (i.consent === "refused") return { id: null, privatePosition: null, savedAndReceived: false };
    if (!r.ok) throw new Error(`submit failed: ${r.status}`);
    const b = (await r.json()) as { id: string; receipt?: string; position?: { lat: number; lon: number } };
    return { id: b.id, privatePosition: b.position ?? null, savedAndReceived: !!b.receipt };
  }
  async approve(id: string, as: Actor) { const r = await this.call(as, "POST", `/interviews/${encodeURIComponent(id)}/approve`); return r.ok; }
  async withdraw(id: string) { const r = await this.call("lead", "POST", `/interviews/${encodeURIComponent(id)}/withdraw`); if (!r.ok) throw new Error(`withdraw failed: ${r.status}`); }
  async publish() { const r = await this.call("lead", "POST", "/publication/run"); if (!r.ok) throw new Error(`publication failed: ${r.status}`); }
  async publicSnapshot(place: string) {
    const r = await this.f(`${this.cfg.publicBase}/insights?cohort=${encodeURIComponent(place)}`);
    if (r.status === 422 || r.status === 404) return { cohorts: [] };       // an unknown or unpublished cohort has nothing public
    if (!r.ok) throw new Error(`public insights failed: ${r.status}`);
    return r.json();
  }
}
