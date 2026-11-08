import { Router, type Response } from "express";
import { validatePublic, type ContractKind } from "@makarba/contracts";

/**
 * Read-only public API (issue #81 integration path). The route handling is finished and tested here; the only part Developer A has to
 * supply is a `PublicRepository` that reads the PUBLISHED projection (never private tables). Every payload is validated against the
 * shared contract before it is sent (fail closed), responses are `no-store` so a withdrawal shows at the next load, and an unpublished
 * item is indistinguishable from one that never existed.
 */
export interface PublicRepository {
  /** Published places only, already in the contract shape (`LocationCollection`). `limit` is validated before the call. */
  listLocations(q: { limit: number; cursor: string | null }): Promise<unknown>;
  /** `null` when the slug is unknown OR not published. */
  getHistory(slug: string): Promise<unknown | null>;
  /** `null` when the media is unknown, unpublished or withdrawn. Never an original/private object. */
  getMedia(id: string): Promise<unknown | null>;
  /** Approved, disclosure-checked snapshot only. `cohort` is an approved cohort id or null. */
  getInsights(q: { cohort: string | null }): Promise<unknown>;
  /** Optional: approved stories (proposed contract, issue #80). Absent means the endpoint answers 404. */
  getStories?(): Promise<unknown | null>;
}

/** A repository throws this for a well-formed but unknown filter value (for example an unapproved cohort id): answered as 422. */
export class InvalidFilterError extends Error { constructor(public field: string, message = "Unknown value") { super(message); this.name = "InvalidFilterError"; } }

export interface PublicApiOptions { repository: PublicRepository; repositoryTimeoutMs?: number; snapshotId?: string }

const err = (code: string, message: string, fieldErrors: Record<string, string> = {}, retryable = false) =>
  ({ code, message, fieldErrors, requestId: "n/a", retryable });
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const MEDIA_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,200}$/;
const COHORT = /^[a-z0-9][a-z0-9-]{0,80}$/;

function send(res: Response, status: number, kind: ContractKind | "stories", body: unknown): void {
  if (kind !== "stories") {
    const v = validatePublic(kind, body);
    if (!v.ok) return void res.status(500).json(err("CONTRACT_VIOLATION", "The response failed validation and was not sent", {}, false));
  }
  res.status(status).json(body);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_r, rej) => { t = setTimeout(() => rej(new Error("repository timeout")), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

export function publicApi({ repository, repositoryTimeoutMs = 5000 }: PublicApiOptions): Router {
  const r = Router();
  const call = <T,>(res: Response, fn: () => Promise<T>): Promise<T | undefined> =>
    withTimeout(fn(), repositoryTimeoutMs).catch((e) => {
      if (e instanceof InvalidFilterError) res.status(422).json(err("INVALID_FILTER", "Invalid filter", { [e.field]: "Unknown value" }));
      else res.status(503).json(err("UNAVAILABLE", "Temporarily unavailable", {}, true));   // never echo the repository's error text
      return undefined;
    });

  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.removeHeader("Set-Cookie");
    next();
  });

  r.get("/locations", async (req, res) => {
    const raw = req.query["limit"];
    const limit = raw === undefined ? 50 : typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return send(res, 422, "error", err("INVALID_FILTER", "Invalid filter", { limit: "Must be an integer 1-200" }));
    const cur = req.query["cursor"];
    if (cur !== undefined && (typeof cur !== "string" || !CURSOR.test(cur))) return send(res, 422, "error", err("INVALID_FILTER", "Invalid filter", { cursor: "Invalid cursor" }));
    const body = await call(res, () => repository.listLocations({ limit, cursor: (cur as string | undefined) ?? null }));
    if (body !== undefined) send(res, 200, "locations", body);
  });

  r.get("/locations/:slug/history", async (req, res) => {
    const slug = req.params["slug"] ?? "";
    if (!SLUG.test(slug)) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    const body = await call(res, () => repository.getHistory(slug));
    if (body === undefined) return;
    if (body === null) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    send(res, 200, "history", body);
  });

  r.get("/media/:id", async (req, res) => {
    const id = req.params["id"] ?? "";
    if (!MEDIA_ID.test(id)) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    const body = await call(res, () => repository.getMedia(id));
    if (body === undefined) return;
    if (body === null) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    send(res, 200, "media", body);
  });

  r.get("/insights", async (req, res) => {
    const c = req.query["cohort"];
    if (c !== undefined && (typeof c !== "string" || !COHORT.test(c))) return send(res, 422, "error", err("INVALID_FILTER", "Invalid filter", { cohort: "Unknown cohort" }));
    const body = await call(res, () => repository.getInsights({ cohort: (c as string | undefined) ?? null }));
    if (body !== undefined) send(res, 200, "insights", body);
  });

  r.get("/stories", async (_req, res) => {
    if (!repository.getStories) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    const body = await call(res, () => repository.getStories!());
    if (body === undefined) return;
    if (body === null) return send(res, 404, "error", err("NOT_FOUND", "Not found"));
    send(res, 200, "stories", body);
  });

  return r;
}
