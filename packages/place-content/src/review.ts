import { type Claim, type Pair, chronologyBlockers, pairBlockers } from "./history.js";
import { lineage, type MediaAsset } from "./media.js";

/**
 * Lead review of historical evidence and media rights (#102, screen A07). Produces the checklist the lead sees and the
 * conditions for editorial approval. Software computes what it can from the records; the lead's judgement is the approval.
 */
export type CheckState = "pass" | "fail" | "na";
export interface CheckResult { state: CheckState; reasons: string[] }
export interface Checklist { date: CheckResult; source: CheckResult; viewpoint: CheckResult; permission: CheckResult; redaction: CheckResult; attribution: CheckResult }
export interface OfficialAttribution { claimed: boolean; verificationEvidence: string | null; scope: string | null }

export type ReviewItem =
  | { kind: "claim"; id: string; claim: Claim; official?: OfficialAttribution; submittedBy: string }
  | { kind: "media"; id: string; assetId: string; assets: MediaAsset[]; official?: OfficialAttribution; submittedBy: string }
  | { kind: "pair"; id: string; pair: Pair; assets: MediaAsset[]; official?: OfficialAttribution; submittedBy: string };

const res = (reasons: string[], na = false): CheckResult => (na && !reasons.length ? { state: "na", reasons: [] } : { state: reasons.length ? "fail" : "pass", reasons });
const known = (d: { value: string | null; precision: string | null }) => d.value !== null && d.value !== "" && d.precision !== null;

export function checklist(item: ReviewItem): Checklist {
  const date: string[] = [], source: string[] = [], view: string[] = [], perm: string[] = [], red: string[] = [], attr: string[] = [];
  let viewNa = true;
  if (item.kind === "claim") {
    const c = item.claim;
    if (!known(c.date)) date.push("no known date");
    if (!c.sourceId || !c.citation?.trim()) source.push("no source citation");
    if (c.rights === "unknown" || c.rights === "all_rights_reserved") perm.push(`rights are "${c.rights}"`);
    if (c.geographicRelevance === "unclear") source.push("relevance to this place is unclear");
    if (c.sourceType === "oral" && !c.corroboratedBy.length) source.push("remembered account without corroboration cannot enter the chronology");
  } else {
    const ids = item.kind === "media" ? [item.assetId] : [item.pair.before.assetId, item.pair.after.assetId];
    for (const id of ids) {
      const { chain, error } = lineage(id, item.assets);
      if (error) { source.push(error); continue; }
      const orig = chain[chain.length - 1]!;
      const copy = chain[0]!;
      if (!known(copy.capturedOn) && !known(orig.capturedOn)) date.push(`${id}: capture date unknown`);
      if (!orig.originalSourceRef) source.push(`${id}: no original source reference`);
      if (!orig.creator) source.push(`${id}: creator unknown`);
      if (["unknown", "all_rights_reserved"].includes(orig.rights)) perm.push(`${id}: rights are "${orig.rights}"`);
      if (!orig.publicationPermitted) perm.push(`${id}: publication not permitted`);
      if (["withdrawn", "research_only", "not_requested"].includes(orig.consent)) perm.push(`${id}: consent is "${orig.consent}"`);
      if (chain.some((a) => a.withdrawn)) perm.push(`${id}: withdrawn`);
      if (orig.containsIdentifiablePeople && (orig.consent !== "granted")) perm.push(`${id}: identifiable people without granted consent`);
      if (orig.containsIdentifiablePeople && copy.reviewRedaction !== "done") red.push(`${id}: face/plate redaction review not done`);
      if (!copy.exifStripped) red.push(`${id}: EXIF metadata not stripped`);
    }
    if (item.kind === "pair") {
      viewNa = false;
      const p = item.pair;
      for (const [side, m] of [["before", p.before], ["after", p.after]] as const) {
        if (!known(m.date)) date.push(`${side} date unknown`);
        else if (!m.dateVerifiedBy) date.push(`${side} date not verified`);
        else if (m.dateVerifiedBy === m.uploadedBy) date.push(`${side} date verified by the uploader`);
        if (m.locationId !== p.locationId) view.push(`${side} image is from a different place`);
      }
      if (p.claimsMatchedViewpoint && !p.viewpointNote.trim()) view.push("matched-viewpoint claim has no note");
      if (!p.viewpointNote.trim() && !p.claimsMatchedViewpoint) view.push("no viewpoint statement recorded");
      if (!p.sourceIds.length || !p.sourceIds.some((s) => p.verifiedSourceIds.includes(s))) source.push("no verified source");
    }
  }
  const o = item.official;
  if (o?.claimed && (!o.verificationEvidence?.trim() || !o.scope?.trim())) attr.push("official attribution is unverified: evidence and scope are required");
  return { date: res(date), source: res(source), viewpoint: res(view, viewNa), permission: res(perm), redaction: res(red, item.kind === "claim"), attribution: res(attr, !o?.claimed) };
}

export type Approval = { ok: true } | { ok: false; blockers: string[] };
/** Editorial approval is possible only when no check fails and the approver is not the submitter. */
export function canApprove(item: ReviewItem, approver: string): Approval {
  const c = checklist(item);
  const blockers = (Object.entries(c) as [keyof Checklist, CheckResult][]).flatMap(([k, v]) => (v.state === "fail" ? v.reasons.map((r) => `${k}: ${r}`) : []));
  if (approver === item.submittedBy) blockers.push("approver must differ from the person who submitted the item");
  // cross-check with the stricter publication rules so approval can never be easier than publication
  if (item.kind === "claim") for (const r of chronologyBlockers({ ...item.claim, verification: "verified", verifiedBy: item.claim.verifiedBy ?? "pending-reviewer" }).filter((r) => r.startsWith("reviewer must differ"))) blockers.push(r);
  if (item.kind === "pair") for (const r of pairBlockers(item.pair, item.assets)) if (!blockers.some((b) => b.includes(r))) blockers.push(`publication rule: ${r}`);
  return blockers.length ? { ok: false, blockers } : { ok: true };
}
