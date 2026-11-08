import { createHash } from "node:crypto";
import { findForbiddenField, validatePublic } from "@makarba/contracts";
import { ratingGroupToCohort, ratingsAnalysis, type CohortLike, type Interview, type Period } from "./index.js";
import { validateManifest, type ApprovedCohort } from "./cohorts.js";

/**
 * Snapshot pipeline for issues #84 and #92 (Developer A owns the real implementation; this is the boundary they connect to).
 * Real database access, authorisation and persistence are injected: `EligibleRecordSource` and `SnapshotStore`. Server-side checks here
 * (k-threshold, manifest differencing, independent approval, stale-input refusal, contract validation) are the privacy control;
 * the browser's own handling is only a second line of defence.
 */
export interface EligibleRecordSource {
  /** Returns records the caller is authorised to aggregate, already restricted to the study. Must throw on failure (never return partial data). */
  fetchRecords(period: Period): Promise<Interview[]>;
  /** A value that changes whenever any input record changes or is withdrawn (for example a max(updated_at, withdrawal_seq) hash). */
  inputRevision(): Promise<string>;
}
export interface Snapshot { id: string; builtBy: string; inputRevision: string; period: Period; policyVersion: string; payload: Record<string, unknown>; state: "candidate" | "published" | "invalidated" }
export interface SnapshotStore {
  save(s: Snapshot): Promise<void>;
  /** Atomically makes `id` the single current public snapshot. */
  publish(id: string, approver: string): Promise<void>;
  invalidate(id: string, reason: string): Promise<void>;
  current(): Promise<Snapshot | null>;
}
export interface BuildOptions { builder: string; datasetKind: "synthetic" | "approved"; questionVersion: string; policyVersion: string; methodologyUrl?: string }

export class PipelineError extends Error { constructor(public code: "UNSAFE_MANIFEST" | "SOURCE_FAILED" | "CONTRACT_VIOLATION" | "SELF_APPROVAL" | "STALE_INPUT" | "STORE_FAILED" | "NOT_A_CANDIDATE", message: string) { super(message); this.name = "PipelineError"; } }

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

/** Builds a CANDIDATE snapshot: one rating cohort per approved place. Nothing is public until `publishSnapshot` succeeds. */
export async function buildSnapshot(source: EligibleRecordSource, manifest: ApprovedCohort[], places: string[], period: Period, opts: BuildOptions): Promise<Snapshot> {
  let records: Interview[], rev: string;
  try { rev = await source.inputRevision(); records = await source.fetchRecords(period); }
  catch (e) { throw new PipelineError("SOURCE_FAILED", `could not read eligible records: ${(e as Error).message}`); }
  const problems = validateManifest(manifest, records);
  if (problems.length) throw new PipelineError("UNSAFE_MANIFEST", problems.map((p) => `${p.cohortId}: ${p.problem}`).join("; "));
  const cohorts: CohortLike[] = [];
  for (const place of places) for (const g of ratingsAnalysis(records, place, period).groups) cohorts.push(ratingGroupToCohort(place, g));
  const id = `snap-${hash({ rev, period, places, policy: opts.policyVersion })}`;
  const payload = {
    cohorts, collectionPeriod: { fromMonth: period.from, throughMonth: period.through }, questionVersion: opts.questionVersion, policyVersion: opts.policyVersion,
    sampleNote: "Counts describe the people interviewed and are not estimates for all residents. Groups for different places overlap.",
    meta: { contractVersion: "1.0.0", datasetKind: opts.datasetKind, snapshotId: id, methodologyUrl: opts.methodologyUrl ?? "/research/methodology" },
  };
  const v = validatePublic("insights", payload);
  if (!v.ok || findForbiddenField(payload) !== null) throw new PipelineError("CONTRACT_VIOLATION", v.ok ? "restricted field in snapshot" : v.error);
  return { id, builtBy: opts.builder, inputRevision: rev, period, policyVersion: opts.policyVersion, payload, state: "candidate" };
}

/** Saves the candidate. Publishing is a separate step by a different person. */
export async function saveCandidate(store: SnapshotStore, s: Snapshot): Promise<void> {
  try { await store.save(s); } catch (e) { throw new PipelineError("STORE_FAILED", `could not save: ${(e as Error).message}`); }
}

/**
 * Independent approval + publication. Refuses: self-approval; a snapshot built from inputs that have changed since (a withdrawal or
 * correction arrived in between); a payload that no longer validates. A failure at any point leaves the previous public snapshot in place.
 */
export async function publishSnapshot(source: EligibleRecordSource, store: SnapshotStore, s: Snapshot, approver: string): Promise<void> {
  if (s.state !== "candidate") throw new PipelineError("NOT_A_CANDIDATE", `snapshot is ${s.state}`);
  if (approver === s.builtBy) throw new PipelineError("SELF_APPROVAL", "the approver must differ from the builder");
  const v = validatePublic("insights", s.payload);
  if (!v.ok || findForbiddenField(s.payload) !== null) throw new PipelineError("CONTRACT_VIOLATION", v.ok ? "restricted field" : v.error);
  let now: string;
  try { now = await source.inputRevision(); } catch (e) { throw new PipelineError("SOURCE_FAILED", (e as Error).message); }
  if (now !== s.inputRevision) throw new PipelineError("STALE_INPUT", "inputs changed (for example a withdrawal) since this snapshot was built; rebuild it");
  try { await store.publish(s.id, approver); } catch (e) { throw new PipelineError("STORE_FAILED", `could not publish: ${(e as Error).message}`); }
}

/** Called when a withdrawal or correction arrives: the current public snapshot is invalidated before any new one can be published. */
export async function invalidateCurrent(store: SnapshotStore, reason: string): Promise<boolean> {
  const cur = await store.current();
  if (!cur) return false;
  await store.invalidate(cur.id, reason);
  return true;
}

// ---- synthetic adapters (tests and local demos only) ----
export class InMemorySource implements EligibleRecordSource {
  constructor(public records: Interview[], public failNext = false) {}
  async fetchRecords(period: Period) { if (this.failNext) throw new Error("database unavailable"); return this.records.filter((r) => r.month >= period.from && r.month <= period.through).map((r) => ({ ...r })); }
  async inputRevision() { return hash(this.records.map((r) => [r.id, r.status, r.withdrawn, r.currentRevision, r.consentAggregate])); }
}
export class InMemoryStore implements SnapshotStore {
  snaps = new Map<string, Snapshot>(); currentId: string | null = null; failPublish = false;
  async save(s: Snapshot) { this.snaps.set(s.id, { ...s }); }
  async publish(id: string) { if (this.failPublish) throw new Error("connection lost"); const s = this.snaps.get(id); if (!s) throw new Error("unknown snapshot"); if (this.currentId) this.snaps.get(this.currentId)!.state = "invalidated"; s.state = "published"; this.currentId = id; }
  async invalidate(id: string) { const s = this.snaps.get(id); if (s) s.state = "invalidated"; if (this.currentId === id) this.currentId = null; }
  async current() { return this.currentId ? this.snaps.get(this.currentId) ?? null : null; }
}
