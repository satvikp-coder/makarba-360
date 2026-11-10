import { findForbiddenField, validatePublic } from "@makarba/contracts";

/**
 * One conformance suite for ANY implementation of the public API: the synthetic mock, the repository-backed router, and Developer A's
 * real server. Assertions never change per target; a target that cannot meet one fails it. Run from the command line with
 * `pnpm --filter @makarba/api conformance <base-url>` (base URL includes /api/v1/public).
 */
export interface Check { id: string; ok: boolean; detail: string }
type Json = Record<string, unknown>;
// Default published slug of the mock API's illustrative Makarba demo dataset (apps/api/src/demo-makarba.ts).
const SYNTHETIC_SLUG = "junction-fruit-carts";
const SYNTHETIC_MEDIA = "synthetic-media-1";

async function get(base: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", ...init });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { res, body: body as Json | null };
}
const apiError = (b: unknown) => { const o = b as Json | null; return !!o && ["code", "message", "fieldErrors", "requestId", "retryable"].every((k) => k in o) && Object.keys(o).length === 5; };

export async function runConformance(base: string, opts: { slug?: string; mediaId?: string; writes?: boolean } = {}): Promise<Check[]> {
  const slug = opts.slug ?? SYNTHETIC_SLUG, mediaId = opts.mediaId ?? SYNTHETIC_MEDIA;
  const out: Check[] = [];
  const check = async (id: string, fn: () => Promise<string | null>) => {
    try { const bad = await fn(); out.push({ id, ok: bad === null, detail: bad ?? "ok" }); }
    catch (e) { out.push({ id, ok: false, detail: `threw: ${(e as Error).message}` }); }
  };

  await check("locations: valid, contract-valid, no private fields, no-store, no cookie", async () => {
    const { res, body } = await get(base, "/locations?limit=50");
    if (res.status !== 200) return `status ${res.status}`;
    const v = validatePublic("locations", body); if (!v.ok) return v.error;
    if (findForbiddenField(body) !== null) return "forbidden field present";
    if (res.headers.get("set-cookie")) return "sets a cookie";
    if (!/no-store/.test(res.headers.get("cache-control") ?? "")) return "not no-store";
    if (!/json/.test(res.headers.get("content-type") ?? "")) return "not JSON";
    return null;
  });
  await check("locations: limit bounds (0, 201, abc, -1, 1.5 are 422 with the shared error shape)", async () => {
    for (const l of ["0", "201", "abc", "-1", "1.5", "99999999"]) {
      const { res, body } = await get(base, `/locations?limit=${l}`);
      if (res.status !== 422) return `limit=${l} gave ${res.status}`;
      if (!apiError(body)) return `limit=${l} error body has the wrong shape`;
    }
    return null;
  });
  await check("locations: limit 1 returns at most one feature", async () => {
    const { body } = await get(base, "/locations?limit=1");
    return Array.isArray((body as Json)?.["features"]) && ((body as Json)["features"] as unknown[]).length <= 1 ? null : "more than the limit";
  });
  await check("history: published slug is contract-valid and private-field free", async () => {
    const { res, body } = await get(base, `/locations/${slug}/history`);
    if (res.status !== 200) return `status ${res.status}`;
    const v = validatePublic("history", body); if (!v.ok) return v.error;
    return findForbiddenField(body) === null ? null : "forbidden field present";
  });
  await check("history: unknown, unpublished-style and malformed slugs give the identical 404", async () => {
    const answers: string[] = [];
    for (const s of ["does-not-exist", "unpublished-candidate", "Bad%20Slug", "..%2F..%2Fetc", "a".repeat(200)]) {
      const { res, body } = await get(base, `/locations/${s}/history`);
      if (res.status !== 404) return `${s.slice(0, 20)} gave ${res.status}`;
      if (!apiError(body)) return `${s.slice(0, 20)}: wrong error shape`;
      answers.push(JSON.stringify([res.status, Object.keys(body ?? {}).sort()]));
    }
    return new Set(answers).size === 1 ? null : "404 answers differ";
  });
  await check("media: published id is contract-valid, https, never an original", async () => {
    const { res, body } = await get(base, `/media/${mediaId}`);
    if (res.status !== 200) return `status ${res.status}`;
    const v = validatePublic("media", body); if (!v.ok) return v.error;
    const u = String((body as Json)["url"]);
    return u.startsWith("https://") && !u.includes("/original/") && findForbiddenField(body) === null ? null : "unsafe url or private field";
  });
  await check("media: unknown and malformed ids give 404 with the shared error shape", async () => {
    for (const id of ["nope", "%27%3B--", "x".repeat(300)]) {
      const { res, body } = await get(base, `/media/${id}`);
      if (res.status !== 404 || !apiError(body)) return `${id.slice(0, 12)} gave ${res.status}`;
    }
    return null;
  });
  await check("insights: contract-valid, no private fields, suppressed groups carry no counts", async () => {
    const { res, body } = await get(base, "/insights");
    if (res.status !== 200) return `status ${res.status}`;
    const v = validatePublic("insights", body); if (!v.ok) return v.error;
    return findForbiddenField(body) === null ? null : "forbidden field present";
  });
  await check("insights: an unknown or malformed cohort is a 422", async () => {
    for (const c of ["no-such-cohort", "%27%20OR%201%3D1"]) {
      const { res } = await get(base, `/insights?cohort=${c}`);
      if (res.status !== 422) return `cohort=${c} gave ${res.status}`;
    }
    return null;
  });
  if (opts.writes !== false) {
    await check("read-only: POST, PUT, PATCH and DELETE are never accepted", async () => {
      for (const m of ["POST", "PUT", "PATCH", "DELETE"]) for (const p of ["/locations", `/locations/${slug}/history`, "/insights"]) {
        const { res } = await get(base, p, { method: m, headers: { "content-type": "application/json" }, body: m === "DELETE" ? undefined : JSON.stringify({ interviewLatitude: 1 }) });
        if (res.status < 400 || res.status >= 500) return `${m} ${p} gave ${res.status}`;
      }
      return null;
    });
  }
  await check("errors never expose stack traces or file paths", async () => {
    for (const p of ["/locations?limit=abc", "/nope", "/locations/x/y/z"]) {
      const res = await fetch(`${base}${p}`);
      const t = await res.text();
      if (/node_modules|\bat .*\(|\.ts:\d|C:\\\\|\/home\/|SyntaxError/.test(t)) return `${p} leaks internals`;
    }
    return null;
  });
  return out;
}

export function summarize(checks: Check[]): { passed: number; failed: Check[] } {
  return { passed: checks.filter((c) => c.ok).length, failed: checks.filter((c) => !c.ok) };
}
