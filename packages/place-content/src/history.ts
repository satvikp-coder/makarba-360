import { checkPublicCopy, type MediaAsset } from "./media.js";

/**
 * Historical evidence (#65 provenance, #66 sourced timeline, #67 comparison pairs) and editorial descriptions (#64).
 * Pure rules over synthetic records. Nothing is invented: an unknown date stays unknown, a missing source blocks verification,
 * and a remembered account is never turned into proven chronology by wording alone.
 */
export type Precision = "day" | "month" | "year" | "decade" | "approximate";
export interface DatedValue { value: string | null; precision: Precision | null; earliest?: string | null; latest?: string | null }
export type SourceType = "primary" | "secondary" | "oral" | "official";
export type Rights = "unknown" | "public_domain" | "open_licence" | "permission_granted" | "all_rights_reserved";
export type Verification = "unverified" | "verified" | "disputed" | "withdrawn";
export type Quality = "unrated" | "low" | "medium" | "high";

export interface Claim {
  id: string; locationId: string; text: string;
  sourceId: string | null; citation: string | null; creator: string | null; sourceType: SourceType; accessedOn: string | null;
  date: DatedValue; geographicRelevance: "exact" | "area" | "unclear";
  rights: Rights; quality: Quality;
  verification: Verification; verifiedBy: string | null; verifiedOn: string | null;
  /** Independent sources that agree. A single remembered account needs at least one to count as chronology. */
  corroboratedBy: string[];
  enteredBy: string;
}

const dateOk = (d: DatedValue) => d.value !== null && d.value !== "" && d.precision !== null;

/** Why this claim cannot stand as a verified chronology entry (empty = it can). */
export function chronologyBlockers(c: Claim): string[] {
  const why: string[] = [];
  if (c.verification !== "verified") why.push(`verification state is "${c.verification}"`);
  if (!c.sourceId || !c.citation?.trim()) why.push("no source citation");
  if (!dateOk(c.date)) why.push("no known date");
  if (c.date.precision === "approximate" && !(c.date.earliest && c.date.latest)) why.push("approximate date has no stated earliest and latest");
  if (c.rights === "unknown" || c.rights === "all_rights_reserved") why.push(`rights are "${c.rights}"`);
  if (c.geographicRelevance === "unclear") why.push("relevance to this place is unclear");
  if (!c.verifiedBy) why.push("no reviewer recorded");
  else if (c.verifiedBy === c.enteredBy) why.push("reviewer must differ from the person who entered the claim");
  if (c.sourceType === "oral" && c.corroboratedBy.length === 0) why.push("a remembered account needs an independent corroborating source before it counts as chronology");
  return why;
}

/** Verification is refused (not silently granted) while a prerequisite is missing. */
export function verifyClaim(c: Claim, reviewer: string, on: string): { ok: true; claim: Claim } | { ok: false; reasons: string[] } {
  const candidate: Claim = { ...c, verification: "verified", verifiedBy: reviewer, verifiedOn: on };
  const why = chronologyBlockers(candidate).filter((r) => !r.startsWith("verification state"));
  // oral accounts may be verified AS accounts without corroboration, but then never enter the chronology (see buildTimeline)
  const blocking = why.filter((r) => !r.startsWith("a remembered account"));
  return blocking.length ? { ok: false, reasons: blocking } : { ok: true, claim: candidate };
}

// ---------------------------------------------------------------- timeline (#66)

export interface Range { from: string; to: string }   // ISO dates, inclusive
/** Supported date range for an entry, or null when the record does not support one. Never uses today's date. */
export function supportedRange(d: DatedValue): Range | null {
  if (!dateOk(d)) return null;
  const v = d.value!;
  if (d.precision === "approximate") return d.earliest && d.latest && d.earliest <= d.latest ? { from: d.earliest, to: d.latest } : null;
  if (d.precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return { from: v, to: v };
  if (d.precision === "month" && /^\d{4}-\d{2}$/.test(v)) { const [y, m] = v.split("-").map(Number) as [number, number]; return { from: `${v}-01`, to: `${v}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}` }; }
  if (d.precision === "year" && /^\d{4}$/.test(v)) return { from: `${v}-01-01`, to: `${v}-12-31` };
  if (d.precision === "decade" && /^\d{3}0s?$/.test(v)) { const y = Number(v.slice(0, 4)); return { from: `${y}-01-01`, to: `${y + 9}-12-31` }; }
  return null;
}
export interface TimelineEntry { claimId: string; text: string; range: Range; precision: Precision; quality: Quality; citation: string; sourceType: SourceType; disputed: boolean }
export interface Timeline { entries: TimelineEntry[]; unplaced: { claimId: string; reasons: string[] }[]; note: string }

export function buildTimeline(claims: Claim[], locationId: string): Timeline {
  const entries: TimelineEntry[] = [];
  const unplaced: Timeline["unplaced"] = [];
  for (const c of claims.filter((x) => x.locationId === locationId && x.verification !== "withdrawn" && x.verification !== "disputed")) {
    const blockers = chronologyBlockers(c);
    const range = supportedRange(c.date);
    if (blockers.length || !range) { unplaced.push({ claimId: c.id, reasons: blockers.length ? blockers : ["date does not match its stated precision"] }); continue; }
    entries.push({ claimId: c.id, text: c.text, range, precision: c.date.precision!, quality: c.quality, citation: c.citation!, sourceType: c.sourceType, disputed: false });
  }
  entries.sort((a, b) => (a.range.from < b.range.from ? -1 : a.range.from > b.range.from ? 1 : a.range.to < b.range.to ? -1 : a.range.to > b.range.to ? 1 : a.claimId < b.claimId ? -1 : 1));
  // overlapping ranges from different sources are shown side by side with a disputed marker only if a claim is marked disputed
  for (const c of claims) if (c.verification === "disputed" && c.locationId === locationId) unplaced.push({ claimId: c.id, reasons: ["disputed: shown with its conflicting source, not on the chronology"] });
  return { entries, unplaced, note: "Entries show the period the source supports, not a single exact date unless the source gives one. Remembered change is not proof of cause." };
}

// ---------------------------------------------------------------- comparison pair (#67)

export interface PairMedia { assetId: string; locationId: string; date: DatedValue; dateVerifiedBy: string | null; uploadedBy: string }
export interface Pair {
  id: string; locationId: string; before: PairMedia; after: PairMedia;
  viewpointNote: string; claimsMatchedViewpoint: boolean; sourceIds: string[]; verifiedSourceIds: string[];
}
export function pairBlockers(p: Pair, assets: MediaAsset[]): string[] {
  const why: string[] = [];
  for (const [side, m] of [["before", p.before], ["after", p.after]] as const) {
    if (m.locationId !== p.locationId) why.push(`${side} image belongs to a different place`);
    if (!dateOk(m.date)) why.push(`${side} image has no known date`);
    if (!m.dateVerifiedBy) why.push(`${side} date is not verified`);
    else if (m.dateVerifiedBy === m.uploadedBy) why.push(`${side} date must be verified by someone other than the uploader`);
    const copy = checkPublicCopy(m.assetId, assets);
    if (!copy.ok) why.push(...copy.reasons.map((r) => `${side} image: ${r}`));
  }
  if (p.before.dateVerifiedBy && p.before.dateVerifiedBy === p.after.dateVerifiedBy) why.push("before and after dates must be verified independently of each other");
  const a = supportedRange(p.before.date), b = supportedRange(p.after.date);
  if (a && b && !(a.to < b.from)) why.push("the before image is not clearly earlier than the after image");
  if (p.claimsMatchedViewpoint && !p.viewpointNote.trim()) why.push("a matched-viewpoint claim needs a viewpoint note");
  if (!p.sourceIds.length) why.push("no source");
  else if (!p.sourceIds.some((s) => p.verifiedSourceIds.includes(s))) why.push("no verified source");
  return why;
}

// ---------------------------------------------------------------- editorial description (#64)

export interface DescriptionDraft {
  id: string; locationId: string; revision: number; text: string; sourceIds: string[];
  /** Dated observations supporting statements about current condition. */
  observationRefs: { id: string; observedOn: string }[];
  authorId: string; reviewedBy: string | null; reviewedOn: string | null;
}
/** Phrases that assert how a place is NOW; they need a dated observation or they are invented. */
const CONDITION = /\b(currently|today|nowadays|at present|right now|is (?:now )?(?:open|closed|clean|dirty|crowded|busy|quiet|safe|unsafe|accessible|well[- ]maintained|in good condition|in poor condition)|are (?:now )?(?:open|closed|crowded))\b/i;
export const REVIEW_VALID_DAYS = 365;

export function descriptionBlockers(d: DescriptionDraft, ctx: { latestRevision: number; today: string; verifiedSourceIds: string[] }): string[] {
  const why: string[] = [];
  if (d.revision !== ctx.latestRevision) why.push(`stale revision ${d.revision}; latest is ${ctx.latestRevision}`);
  if (!d.text.trim()) why.push("description is empty");
  if (!d.sourceIds.length) why.push("no source");
  else if (!d.sourceIds.some((s) => ctx.verifiedSourceIds.includes(s))) why.push("no verified source");
  if (CONDITION.test(d.text)) {
    const recent = d.observationRefs.filter((o) => (Date.parse(ctx.today) - Date.parse(o.observedOn)) / 86_400_000 <= REVIEW_VALID_DAYS);
    if (!d.observationRefs.length) why.push("describes current condition without a dated observation");
    else if (!recent.length) why.push("the dated observation is more than a year old; describe it as it was on that date");
  }
  if (!d.reviewedBy || !d.reviewedOn) why.push("not reviewed");
  else {
    if (d.reviewedBy === d.authorId) why.push("reviewer must differ from author");
    const age = (Date.parse(ctx.today) - Date.parse(d.reviewedOn)) / 86_400_000;
    if (!(age >= 0)) why.push("review date is in the future");
    else if (age > REVIEW_VALID_DAYS) why.push(`review is ${Math.floor(age)} days old; re-review needed for current publication`);
  }
  return why;
}
