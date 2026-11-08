import { createHash } from "node:crypto";
import type { Authorizer, Principal, Resource } from "@makarba/authz";
import { findForbiddenField } from "@makarba/contracts";
import { csvCell } from "@makarba/gis-io";

/**
 * Purpose-limited anonymised export jobs (#104). A job moves requested -> approved -> ready; the file contains ONLY rows of the
 * approved aggregate projection (never raw interviews or exact positions), rows under k are removed, spreadsheet formulas are
 * neutralised, and the download is private, expiring, limited in count, bound to the requester and audited. Pure model with
 * injected clock and token source; storage, routes and the real worker belong to Developer A (#99, #92, #81).
 */
export const K = 5;
export const FIELD_ALLOWLIST = ["group", "period", "n", "valid_n"] as const;
export const MAX_TTL_HOURS = 72;
export const DEFAULT_TTL_HOURS = 24;
export const MAX_DOWNLOADS = 3;

export interface AggregateRow { group: string; period: string; n: number; valid_n: number }
export type JobState = "requested" | "approved" | "ready" | "rejected" | "revoked" | "failed";
export interface AuditEvent { at: string; actor: string; action: string; outcome: "ok" | "denied"; detail: string }
export interface Job {
  id: string; state: JobState; requester: string; studyAreaId: string;
  purpose: string; format: "csv" | "geojson"; fields: string[];
  approver: string | null; approvedAt: string | null;
  expiresAt: string | null; tokenHash: string | null; downloads: number;
  file: { body: string; rows: number; suppressedRows: number } | null;
  audit: AuditEvent[];
}
export type Result<T> = ({ ok: true } & T) | { ok: false; reasons: string[] };

const log = (j: Job, at: Date, actor: string, action: string, outcome: "ok" | "denied", detail: string): Job => ({ ...j, audit: [...j.audit, { at: at.toISOString(), actor, action, outcome, detail }] });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function requestExport(az: Authorizer, who: Principal, res: Resource & { studyAreaId: string }, req: { id: string; purpose: string; format: "csv" | "geojson"; fields: string[] }, now: Date): Result<{ job: Job }> {
  const why: string[] = [];
  const d = az.can(who, "export.restricted", res, { now, purposeApproved: true });   // authority to ask; the purpose itself is approved by a second person below
  if (!d.allow) why.push(`not allowed to request exports: ${d.reason}`);
  if (req.purpose.trim().length < 10) why.push("state the purpose in at least 10 characters");
  if (!req.fields.length) why.push("choose at least one field");
  const badName = req.fields.filter((f) => !(FIELD_ALLOWLIST as readonly string[]).includes(f));
  if (badName.length) why.push(`fields not allowed: ${badName.join(", ")}`);
  if (req.fields.some((f) => findForbiddenField({ [f]: 1 }) !== null)) why.push("a requested field is a raw identifier or position");
  if (why.length) return { ok: false, reasons: why };
  const job: Job = { id: req.id, state: "requested", requester: who.userId, studyAreaId: res.studyAreaId, purpose: req.purpose.trim(), format: req.format, fields: [...req.fields], approver: null, approvedAt: null, expiresAt: null, tokenHash: null, downloads: 0, file: null, audit: [] };
  return { ok: true, job: log(job, now, who.userId, "request", "ok", `${req.format}; fields=${req.fields.join("|")}`) };
}

/** A different person must approve the stated purpose and field list. */
export function approveExport(az: Authorizer, job: Job, approver: Principal, now: Date): Result<{ job: Job }> {
  if (job.state !== "requested") return { ok: false, reasons: [`job is ${job.state}`] };
  if (approver.userId === job.requester) return { ok: false, reasons: ["the requester cannot approve their own export"] };
  const d = az.can(approver, "export.restricted", { studyAreaId: job.studyAreaId }, { now, purposeApproved: true });
  if (!d.allow) return { ok: false, reasons: [`not allowed to approve exports: ${d.reason}`] };
  return { ok: true, job: log({ ...job, state: "approved", approver: approver.userId, approvedAt: now.toISOString() }, now, approver.userId, "approve", "ok", "purpose and fields approved") };
}

/** Builds the file from aggregate rows. Rows under k are dropped (and counted, not shown); if too little remains the job fails closed. */
export function runExport(job: Job, rows: AggregateRow[], now: Date, newToken: () => string, ttlHours = DEFAULT_TTL_HOURS): Result<{ job: Job; token: string }> {
  if (job.state !== "approved") return { ok: false, reasons: [`job is ${job.state}; it must be approved first`] };
  if (!(ttlHours > 0) || ttlHours > MAX_TTL_HOURS) return { ok: false, reasons: [`expiry must be between 0 and ${MAX_TTL_HOURS} hours`] };
  const bad = rows.find((r) => !Number.isInteger(r.n) || r.n < 0 || !Number.isInteger(r.valid_n) || r.valid_n < 0 || r.valid_n > r.n);
  if (bad) return { ok: false, reasons: ["input rows are inconsistent (valid_n must not exceed n); export stopped"] };
  const safe = rows.filter((r) => r.n >= K && r.valid_n >= K);
  const suppressedRows = rows.length - safe.length;
  if (safe.length === 0) return { ok: false, reasons: ["every row is below the minimum group size; nothing can be exported"] };
  // one hidden row among published totals can be recovered by subtraction: hide the smallest published row too
  let out = safe;
  if (suppressedRows === 1 && safe.length > 1) { const smallest = [...safe].sort((a, b) => a.n - b.n)[0]!; out = safe.filter((r) => r !== smallest); }
  const hidden = rows.length - out.length;
  const cell = (r: AggregateRow, f: string) => String(r[f as keyof AggregateRow]);
  const body = job.format === "csv"
    ? [job.fields.map(csvCell).join(","), ...out.map((r) => job.fields.map((f) => csvCell(cell(r, f))).join(","))].join("\r\n") + "\r\n"
    : JSON.stringify({ type: "AggregateTable", rows: out.map((r) => Object.fromEntries(job.fields.map((f) => [f, r[f as keyof AggregateRow]]))) });
  const token = newToken();
  const expires = new Date(now.getTime() + ttlHours * 3_600_000);
  const next: Job = { ...job, state: "ready", file: { body, rows: out.length, suppressedRows: hidden }, tokenHash: sha(token), expiresAt: expires.toISOString(), downloads: 0 };
  return { ok: true, job: log(next, now, "system", "run", "ok", `rows=${out.length}; suppressed=${hidden}`), token };
}

/** Private download: requester only, correct token, before expiry, limited count. Every attempt is audited; payloads never are. */
export function download(az: Authorizer, job: Job, who: Principal | null, token: string, now: Date): { job: Job; result: { ok: true; body: string } | { ok: false; reason: string } } {
  const deny = (reason: string): { job: Job; result: { ok: false; reason: string } } => ({ job: log(job, now, who?.userId ?? "anonymous", "download", "denied", reason), result: { ok: false, reason } });
  if (!who) return deny("sign-in required");
  if (job.state === "revoked") return deny("export was revoked");
  if (job.state !== "ready" || !job.file || !job.tokenHash || !job.expiresAt) return deny("export is not ready");
  if (who.userId !== job.requester) return deny("only the requester can download");
  const d = az.can(who, "export.restricted", { studyAreaId: job.studyAreaId }, { now, purposeApproved: true });
  if (!d.allow) return deny("access has been withdrawn");
  if (now.getTime() >= new Date(job.expiresAt).getTime()) return deny("download link has expired");
  if (job.downloads >= MAX_DOWNLOADS) return deny("download limit reached");
  if (sha(token) !== job.tokenHash) return deny("invalid download link");
  return { job: log({ ...job, downloads: job.downloads + 1 }, now, who.userId, "download", "ok", `rows=${job.file.rows}`), result: { ok: true, body: job.file.body } };
}

export function revokeExport(job: Job, by: string, reason: string, now: Date): Result<{ job: Job }> {
  if (!reason.trim()) return { ok: false, reasons: ["a reason is required"] };
  return { ok: true, job: log({ ...job, state: "revoked", file: null, tokenHash: null }, now, by, "revoke", "ok", reason.trim()) };
}
