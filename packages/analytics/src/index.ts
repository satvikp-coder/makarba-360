/**
 * Aggregate analytics over eligible interviews (issues #85, #86, #87, #89). Pure functions over an in-memory record shape;
 * the real worker reads Developer A's tables (live prerequisite #84) and must produce the same results. Fixtures are synthetic.
 *
 * Invariants (see docs/architecture/analytics.md):
 *  - counts are DISTINCT eligible interviews, never rows or topic blocks;
 *  - a topic answer belongs to the place it is about (subjectId), never to where the interview was held;
 *  - unsure, refused, not asked and blank are counted separately and never become 0;
 *  - cells below k are suppressed (not shown as 0), with complementary suppression so they cannot be recovered by subtraction;
 *  - questionnaire versions are not pooled unless a reviewed mapping says they measure the same concept.
 */
export const K = 5;

export type ReviewStatus = "approved" | "rejected" | "draft" | "duplicate";
export type RatingReason = "answered" | "unsure" | "refused" | "not_asked";
export interface Topic {
  subjectId: string;
  rating: number | null; ratingReason: RatingReason;
  change: "better" | "worse" | "same" | "dont_know" | null;
  /** Categories the respondent selected (multi-select). null = question not answered/blank, [] = answered "none". */
  issuesSelected: string[] | null;
  /** Themes assigned by an analyst against a codebook version. */
  issuesCoded: { theme: string; coder: string; codebookVersion: string }[];
}
export interface Interview {
  id: string;
  status: ReviewStatus; currentRevision: boolean; consentResearch: boolean; consentAggregate: boolean; withdrawn: boolean;
  month: string;                         // "YYYY-MM"
  questionVersion: string;
  stakeholder: string | null;            // null = unknown/refused
  association: "under1" | "1to5" | "over5" | null;
  /** Where the interview was held. Present for realism; NEVER used by any public calculation. */
  interviewLocationId: string;
  topics: Topic[];
}
export interface Period { from: string; through: string }

export type Exclusion = "duplicate_record" | "not_approved" | "superseded_revision" | "no_research_consent" | "no_aggregate_consent" | "withdrawn" | "outside_period";
export interface Eligibility { eligible: Interview[]; collected: number; excluded: Partial<Record<Exclusion, number>> }

export function eligibility(all: Interview[], period: Period): Eligibility {
  const excluded: Eligibility["excluded"] = {};
  const bump = (r: Exclusion) => { excluded[r] = (excluded[r] ?? 0) + 1; };
  const seen = new Set<string>();
  const eligible: Interview[] = [];
  for (const i of all) {
    if (seen.has(i.id)) { bump("duplicate_record"); continue; }
    seen.add(i.id);
    if (i.withdrawn) bump("withdrawn");
    else if (i.status !== "approved") bump("not_approved");
    else if (!i.currentRevision) bump("superseded_revision");
    else if (!i.consentResearch) bump("no_research_consent");
    else if (!i.consentAggregate) bump("no_aggregate_consent");
    else if (i.month < period.from || i.month > period.through) bump("outside_period");
    else eligible.push(i);
  }
  return { eligible, collected: seen.size, excluded };
}

export interface Cell { code: string; count: number }
export interface Shown { code: string; count: number }
export interface Cells { shown: Shown[]; suppressedCount: number; complementary: boolean }

/** Suppress cells below k; if exactly one is hidden, also hide the smallest remaining so a published total cannot reveal it. */
export function suppress(cells: Cell[], k = K): Cells {
  const sorted = [...cells].filter((c) => c.count > 0).sort((a, b) => a.count - b.count || (a.code < b.code ? -1 : 1));
  const hidden = sorted.filter((c) => c.count < k);
  let complementary = false;
  if (hidden.length === 1) {
    const next = sorted.find((c) => c.count >= k);
    if (next) { hidden.push(next); complementary = true; }
  }
  const hide = new Set(hidden.map((c) => c.code));
  return { shown: sorted.filter((c) => !hide.has(c.code)).sort((a, b) => (a.code < b.code ? -1 : 1)), suppressedCount: hide.size, complementary };
}

const distinct = (xs: Iterable<string>) => new Set(xs).size;
const tally = (xs: string[]): Cell[] => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)); return [...m].map(([code, count]) => ({ code, count })); };

// ------------------------------------------------------------------ #85 stakeholders

export interface StakeholderResult {
  collected: number; analysed: number; excluded: Eligibility["excluded"];
  released: boolean; reason?: "BELOW_K";
  categories: Cells; unknownOrRefused: number | null;
  basis: string;
}
export function stakeholderDistribution(all: Interview[], period: Period, k = K): StakeholderResult {
  const e = eligibility(all, period);
  const basis = "Distinct approved interviews in the period. Each interview is counted once in one category.";
  const base = { collected: e.collected, analysed: e.eligible.length, excluded: e.excluded, basis };
  if (e.eligible.length < k) return { ...base, released: false, reason: "BELOW_K", categories: { shown: [], suppressedCount: 0, complementary: false }, unknownOrRefused: null };
  const known = e.eligible.filter((i) => i.stakeholder !== null).map((i) => i.stakeholder!);
  const unknown = e.eligible.length - known.length;
  return { ...base, released: true, categories: suppress(tally(known), k), unknownOrRefused: unknown >= k ? unknown : null };
}

// ------------------------------------------------------------------ #86 issues

export interface IssuesResult {
  released: boolean; reason?: "BELOW_K";
  respondingInterviews: number; notAnswered: number;
  selected: Cells; coded: Cells;
  percentOfResponding: { selected: Record<string, number>; coded: Record<string, number> };
  multiResponseNote: string; codebookVersions: string[]; coders: number;
}
/**
 * Selected categories (what the respondent ticked) and analyst-coded themes (what a coder assigned) are reported
 * separately. One interview counts once per category even if it mentions it for several places. Because several
 * categories can apply, percentages are of RESPONDING interviews and may add up to more than 100%.
 */
export function issuesAnalysis(all: Interview[], period: Period, k = K): IssuesResult {
  const e = eligibility(all, period);
  const note = "People could choose or be coded for more than one issue, so percentages can add up to more than 100%.";
  const responding = e.eligible.filter((i) => i.topics.some((t) => t.issuesSelected !== null || t.issuesCoded.length > 0));
  const empty: Cells = { shown: [], suppressedCount: 0, complementary: false };
  const base = { respondingInterviews: responding.length, notAnswered: e.eligible.length - responding.length, multiResponseNote: note };
  if (responding.length < k) return { ...base, released: false, reason: "BELOW_K", selected: empty, coded: empty, percentOfResponding: { selected: {}, coded: {} }, codebookVersions: [], coders: 0 };
  // distinct interview per category
  const selMap = new Map<string, Set<string>>(), codMap = new Map<string, Set<string>>();
  const versions = new Set<string>(), coders = new Set<string>();
  for (const i of responding) for (const t of i.topics) {
    for (const c of t.issuesSelected ?? []) (selMap.get(c) ?? selMap.set(c, new Set()).get(c)!).add(i.id);
    for (const c of t.issuesCoded) { (codMap.get(c.theme) ?? codMap.set(c.theme, new Set()).get(c.theme)!).add(i.id); versions.add(c.codebookVersion); coders.add(c.coder); }
  }
  const toCells = (m: Map<string, Set<string>>) => [...m].map(([code, s]) => ({ code, count: s.size }));
  const selected = suppress(toCells(selMap), k), coded = suppress(toCells(codMap), k);
  const pct = (c: Cells) => Object.fromEntries(c.shown.map((s) => [s.code, Math.round((s.count / responding.length) * 1000) / 10]));
  return { ...base, released: true, selected, coded, percentOfResponding: { selected: pct(selected), coded: pct(coded) }, codebookVersions: [...versions].sort(), coders: coders.size };
}

// ------------------------------------------------------------------ #87 ratings and perceived change

export interface RatingGroup {
  versions: string[]; pooledByReviewedMapping: boolean;
  respondents: number; validN: number; unsureN: number; refusedN: number; notAskedN: number; invalidN: number;
  released: boolean; reason?: "BELOW_K";
  distribution: Cells;                  // ratings 1..5
  change: Cells;                        // better / worse / same
  changeDontKnow: number | null;
  byAssociation: { shown: Shown[]; suppressedCount: number };
}
export interface RatingsResult { subjectId: string; groups: RatingGroup[]; note: string }
/**
 * Ratings for ONE place. Only topic answers whose subject is that place are used. Different questionnaire versions form
 * separate groups unless a reviewed mapping (`version -> concept`) says they may be pooled.
 */
export function ratingsAnalysis(all: Interview[], subjectId: string, period: Period, opts: { k?: number; mapping?: Record<string, string> } = {}): RatingsResult {
  const k = opts.k ?? K;
  const e = eligibility(all, period);
  const byGroup = new Map<string, { versions: Set<string>; rows: { i: Interview; t: Topic }[] }>();
  for (const i of e.eligible) {
    const topics = i.topics.filter((t) => t.subjectId === subjectId);
    if (!topics.length) continue;
    const key = opts.mapping?.[i.questionVersion] ?? i.questionVersion;
    const g = byGroup.get(key) ?? byGroup.set(key, { versions: new Set(), rows: [] }).get(key)!;
    g.versions.add(i.questionVersion);
    // one topic block per interview per place counts once
    g.rows.push({ i, t: topics[0]! });
  }
  const groups: RatingGroup[] = [...byGroup.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, g]) => {
    const rows = g.rows;
    const valid = rows.filter(({ t }) => t.ratingReason === "answered" && t.rating !== null && Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5);
    const invalid = rows.filter(({ t }) => t.ratingReason === "answered" && !(t.rating !== null && Number.isInteger(t.rating) && t.rating >= 1 && t.rating <= 5)).length;
    const count = (r: RatingReason) => rows.filter(({ t }) => t.ratingReason === r).length;
    const changes = rows.map(({ t }) => t.change).filter((c): c is NonNullable<Topic["change"]> => c !== null);
    const dk = changes.filter((c) => c === "dont_know").length;
    const assoc = suppress(tally(rows.filter(({ i }) => i.association).map(({ i }) => i.association!)), k);
    const released = rows.length >= k;
    const base = {
      versions: [...g.versions].sort(), pooledByReviewedMapping: g.versions.size > 1 || (opts.mapping?.[[...g.versions][0]!] !== undefined && key !== [...g.versions][0]),
      respondents: rows.length, validN: valid.length, unsureN: count("unsure"), refusedN: count("refused"), notAskedN: count("not_asked"), invalidN: invalid,
    };
    if (!released) return { ...base, released: false, reason: "BELOW_K" as const, distribution: { shown: [], suppressedCount: 0, complementary: false }, change: { shown: [], suppressedCount: 0, complementary: false }, changeDontKnow: null, byAssociation: { shown: [], suppressedCount: 0 } };
    return {
      ...base, released: true,
      distribution: suppress(tally(valid.map(({ t }) => String(t.rating))), k),
      change: suppress(tally(changes.filter((c) => c !== "dont_know")), k),
      changeDontKnow: dk >= k ? dk : null,
      byAssociation: { shown: assoc.shown, suppressedCount: assoc.suppressedCount },
    };
  });
  return { subjectId, groups, note: "Reported change is what respondents remember, not measured change, and says nothing about cause. Counts describe people interviewed, not all residents." };
}

// ------------------------------------------------------------------ #89 location summaries

export interface LocationSummary {
  subjectId: string; released: boolean; reason?: "BELOW_K";
  interviews: number | null;            // distinct interviews that DISCUSSED this place
  alsoDiscussedOtherPlaces: number | null;
  overlapNote: string;
  topIssues: Cells;
}
export function locationSummary(all: Interview[], subjectId: string, period: Period, k = K): LocationSummary {
  const e = eligibility(all, period);
  const about = e.eligible.filter((i) => i.topics.some((t) => t.subjectId === subjectId));
  const overlapNote = "Respondents can talk about several places, so interview counts for different places overlap and must not be added together.";
  if (about.length < k) return { subjectId, released: false, reason: "BELOW_K", interviews: null, alsoDiscussedOtherPlaces: null, overlapNote, topIssues: { shown: [], suppressedCount: 0, complementary: false } };
  const multi = about.filter((i) => distinct(i.topics.map((t) => t.subjectId)) > 1).length;
  const issues = new Map<string, Set<string>>();
  for (const i of about) for (const t of i.topics.filter((t) => t.subjectId === subjectId)) for (const c of t.issuesSelected ?? []) (issues.get(c) ?? issues.set(c, new Set()).get(c)!).add(i.id);
  const alsoRaw = multi;
  // the overlap figure and the single-place remainder must not allow recovery of a small cell
  const single = about.length - multi;
  const showOverlap = alsoRaw >= k && single >= k;
  return {
    subjectId, released: true, interviews: about.length, alsoDiscussedOtherPlaces: showOverlap ? alsoRaw : null, overlapNote,
    topIssues: suppress([...issues].map(([code, s]) => ({ code, count: s.size })), k),
  };
}

// ------------------------------------------------------------------ contract projection

export interface CohortLike {
  cohortId: string; suppressed: boolean; n: number | null; validAnswerN: number | null; missingN: number | null; unsureN: number | null;
  respondentCategories: { code: string; count: number }[]; ratings: { value: number; count: number }[]; issues: { code: string; count: number }[];
  denominatorLabel?: string; countingRule?: string; reasonCode?: string;
}
/** Projects one rating group to the public contract (`Cohort`). Hidden cells are omitted, never emitted as 0. */
export function ratingGroupToCohort(subjectId: string, g: RatingGroup): CohortLike {
  if (!g.released) return { cohortId: `${subjectId}:${g.versions.join("+")}`, suppressed: true, n: null, validAnswerN: null, missingN: null, unsureN: null, respondentCategories: [], ratings: [], issues: [], reasonCode: "DISCLOSURE_POLICY" };
  const ratings = g.distribution.shown.map((s) => ({ value: Number(s.code), count: s.count }));
  const hiddenValid = g.validN - ratings.reduce((a, r) => a + r.count, 0);
  // The contract requires ratings to sum to validAnswerN; if cells were hidden the group cannot be expressed safely.
  if (hiddenValid !== 0) return { cohortId: `${subjectId}:${g.versions.join("+")}`, suppressed: true, n: null, validAnswerN: null, missingN: null, unsureN: null, respondentCategories: [], ratings: [], issues: [], reasonCode: "DISCLOSURE_POLICY" };
  return {
    cohortId: `${subjectId}:${g.versions.join("+")}`, suppressed: false, n: g.respondents, validAnswerN: g.validN, missingN: g.refusedN + g.notAskedN + g.invalidN, unsureN: g.unsureN,
    respondentCategories: [], ratings, issues: [],
    denominatorLabel: `${g.validN} valid answers from ${g.respondents} interviews about this place`,
    countingRule: "Distinct interview base; cohorts for different places overlap",
  };
}
export * from "./cohorts.js";
export * from "./pipeline.js";
