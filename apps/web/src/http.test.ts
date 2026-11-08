import { afterEach, describe, expect, it } from "vitest";
import { apiFetch, policy, TimeoutError } from "./http.js";

const saved = { ...policy };
afterEach(() => Object.assign(policy, saved));
const fast = () => Object.assign(policy, { timeoutMs: 50, retryDelayMs: 1, retries: 1 });
const ok = () => new Response("{}", { status: 200 });

describe("apiFetch policy", () => {
  it("returns a good response with one call and passes init through", async () => {
    let n = 0; let seen: RequestInit | undefined;
    const r = await apiFetch(((_u: string, i?: RequestInit) => { n++; seen = i; return Promise.resolve(ok()); }) as typeof fetch, "/x", { credentials: "omit", cache: "no-store" });
    expect([r.status, n]).toEqual([200, 1]);
    expect(seen).toMatchObject({ credentials: "omit", cache: "no-store" });
  });
  it("retries once after a network error and after 503, then gives up with the last result", async () => {
    fast();
    let n = 0;
    const flaky = (() => (++n === 1 ? Promise.reject(new TypeError("net")) : Promise.resolve(ok()))) as typeof fetch;
    expect((await apiFetch(flaky, "/x")).status).toBe(200); expect(n).toBe(2);
    n = 0;
    const down = (() => { n++; return Promise.resolve(new Response("{}", { status: 503 })); }) as typeof fetch;
    expect((await apiFetch(down, "/x")).status).toBe(503); expect(n).toBe(2);
    n = 0;
    await expect(apiFetch((() => { n++; return Promise.reject(new TypeError("net")); }) as typeof fetch, "/x")).rejects.toThrow("net"); expect(n).toBe(2);
  });
  it("never retries a 4xx or a 500", async () => {
    fast();
    for (const st of [400, 404, 422, 500]) { let n = 0; await apiFetch((() => { n++; return Promise.resolve(new Response("{}", { status: st })); }) as typeof fetch, "/x"); expect(n, String(st)).toBe(1); }
  });
  it("times out a request that never answers, then retries, then reports a timeout", async () => {
    fast();
    let n = 0;
    const hang = ((_u: string, i?: RequestInit) => { n++; return new Promise((_r, rej) => i?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); }) as typeof fetch;
    await expect(apiFetch(hang, "/x")).rejects.toBeInstanceOf(TimeoutError);
    expect(n).toBe(2);
  });
  it("caller cancellation stops at once with no retry", async () => {
    fast();
    const ac = new AbortController(); let n = 0;
    const hang = ((_u: string, i?: RequestInit) => { n++; return new Promise((_r, rej) => i?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); }) as typeof fetch;
    const p = apiFetch(hang, "/x", { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(n).toBe(1);
    await expect(apiFetch(hang, "/x", { signal: ac.signal })).rejects.toMatchObject({ name: "AbortError" });   // already aborted: not even sent
    expect(n).toBe(1);
  });
});
