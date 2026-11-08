import { eligibility, K, type Interview, type Period } from "./index.js";

/**
 * Constrained dashboard cohorts (#91). Visitors never compose their own filters: the dashboard offers a fixed manifest of
 * reviewed cohorts, each a (period, stakeholder, place) combination, and a request must match one of them exactly.
 * Building the manifest checks, against the data, that no cohort is too small and that no two cohorts differ by fewer than
 * k people (which would reveal the difference), so intersecting filters cannot be used to reconstruct a hidden group.
 */
export interface ApprovedCohort { id: string; label: string; period: Period; stakeholder: string | null; placeId: string | null }
export interface CohortRequest { period?: string | null; stakeholder?: string | null; place?: string | null }

export const periodKey = (p: Period) => `${p.from}..${p.through}`;

export type Resolve = { ok: true; cohort: ApprovedCohort; cacheKey: string } | { ok: false; reason: string };

/** Exact match on all three dimensions. Missing means "all", never a wildcard that selects several cohorts. */
export function resolveCohort(manifest: ApprovedCohort[], req: CohortRequest, snapshotId: string): Resolve {
  const want = { period: req.period ?? null, stakeholder: req.stakeholder ?? null, place: req.place ?? null };
  if (want.period === null) return { ok: false, reason: "a reviewed period is required" };
  const hit = manifest.filter((c) => periodKey(c.period) === want.period && c.stakeholder === want.stakeholder && c.placeId === want.place);
  if (hit.length !== 1) return { ok: false, reason: "that combination is not an approved cohort" };
  // the key is derived from the approved id only, so no request can create a new cache entry for a free-form query
  return { ok: true, cohort: hit[0]!, cacheKey: `cohort:${snapshotId}:${hit[0]!.id}` };
}

const idsOf = (all: Interview[], c: ApprovedCohort): Set<string> => {
  const e = eligibility(all, c.period).eligible;
  return new Set(e.filter((i) => (c.stakeholder === null || i.stakeholder === c.stakeholder) && (c.placeId === null || i.topics.some((t) => t.subjectId === c.placeId))).map((i) => i.id));
};

export interface ManifestProblem { cohortId: string; problem: string }
/** Checks a manifest against the data. An empty list means it is safe to publish as it stands. */
export function validateManifest(manifest: ApprovedCohort[], all: Interview[], k = K): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const seen = new Set<string>();
  const sets = new Map<string, Set<string>>();
  for (const c of manifest) {
    if (seen.has(c.id)) problems.push({ cohortId: c.id, problem: "duplicate id" });
    seen.add(c.id);
    const key = `${periodKey(c.period)}|${c.stakeholder}|${c.placeId}`;
    if ([...sets.keys()].includes(key)) problems.push({ cohortId: c.id, problem: "same combination listed twice" });
    const s = idsOf(all, c);
    sets.set(key, s);
    if (s.size < k) problems.push({ cohortId: c.id, problem: `only ${s.size} interviews; below the minimum of ${k}` });
  }
  const entries = manifest.map((c) => ({ c, s: idsOf(all, c) }));
  for (const a of entries) for (const b of entries) {
    if (a.c.id === b.c.id) continue;
    const subset = b.s.size < a.s.size && [...b.s].every((x) => a.s.has(x));
    if (subset && a.s.size - b.s.size < k) problems.push({ cohortId: b.c.id, problem: `differs from "${a.c.id}" by only ${a.s.size - b.s.size} interviews; the difference would be revealed` });
  }
  return problems;
}
