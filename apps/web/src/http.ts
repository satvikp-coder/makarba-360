/**
 * One policy for every public API request: a timeout, caller cancellation, and a single retry of an idempotent GET after a network
 * failure or 502/503/504. Cancelled requests are never retried. Nothing here adds credentials: callers pass `credentials: "omit"`.
 */
export const policy = { timeoutMs: 10_000, retries: 1, retryDelayMs: 250 };

export class TimeoutError extends Error { constructor() { super("request timed out"); this.name = "TimeoutError"; } }

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  if (!ms) return resolve();
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
});

export async function apiFetch(fetcher: typeof fetch, url: string, init: RequestInit = {}): Promise<Response> {
  const outer = init.signal ?? undefined;
  let last: unknown;
  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    if (outer?.aborted) throw new DOMException("aborted", "AbortError");
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    outer?.addEventListener("abort", onAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, policy.timeoutMs);
    try {
      const res = await fetcher(url, { ...init, signal: ac.signal });
      if ([502, 503, 504].includes(res.status) && attempt < policy.retries) { last = res; await sleep(policy.retryDelayMs * (attempt + 1), outer); continue; }
      return res;
    } catch (e) {
      if (outer?.aborted) throw e;                       // the caller cancelled: stop at once, no retry
      last = timedOut ? new TimeoutError() : e;
      if (attempt >= policy.retries) throw last;
      await sleep(policy.retryDelayMs * (attempt + 1), outer);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    }
  }
  if (last instanceof Response) return last;
  throw last;
}
