import { chronologyBlockers, pairBlockers, type Claim, type Pair } from "./history.js";
import { checkPublicCopy, lineage, type MediaAsset } from "./media.js";
import { storyBlockers, type Story } from "./story.js";

/**
 * Publication audit (#123): given everything that is about to be public, trace each item back to its evidence and report
 * pass, fail or unavailable. An item whose evidence (image, date, source) is absent is "unavailable": the feature is hidden,
 * never filled in. The audit reads records only; it cannot tell whether a recorded licence or consent is genuine.
 */
export interface PublicationSnapshot {
  claims: Claim[]; pairs: Pair[]; panoramaAssetIds: string[]; stories: Story[];
  assets: MediaAsset[]; latestStoryRevision: Record<string, number>;
}
export type AuditStatus = "pass" | "fail" | "unavailable";
export interface AuditItem { type: "claim" | "pair" | "panorama" | "story"; id: string; status: AuditStatus; trace: string[]; reasons: string[] }
export interface AuditReport { verdict: "PASS" | "FAIL"; items: AuditItem[]; counts: Record<AuditStatus, number>; publishable: { type: AuditItem["type"]; id: string }[] }

const chain = (id: string, assets: MediaAsset[]): string[] => { const l = lineage(id, assets); return l.error ? [`${id} (broken: ${l.error})`] : l.chain.map((a) => a.id); };

export function auditPublication(s: PublicationSnapshot): AuditReport {
  const items: AuditItem[] = [];
  for (const c of s.claims) {
    const noDate = !c.date.value || !c.date.precision;
    const reasons = chronologyBlockers(c);
    items.push({ type: "claim", id: c.id, trace: [c.sourceId ? `source ${c.sourceId}` : "no source", c.citation ?? "no citation"], reasons, status: reasons.length ? (noDate ? "unavailable" : "fail") : "pass" });
  }
  for (const p of s.pairs) {
    const missingMedia = [p.before.assetId, p.after.assetId].filter((id) => !s.assets.some((a) => a.id === id));
    const noDate = !p.before.date.value || !p.after.date.value;
    if (missingMedia.length || noDate) {
      items.push({ type: "pair", id: p.id, trace: [...chain(p.before.assetId, s.assets), ...chain(p.after.assetId, s.assets)], status: "unavailable",
        reasons: [...missingMedia.map((id) => `image ${id} is absent`), ...(noDate ? ["a historical date is absent"] : [])] });
      continue;
    }
    const reasons = pairBlockers(p, s.assets);
    items.push({ type: "pair", id: p.id, trace: [...chain(p.before.assetId, s.assets), ...chain(p.after.assetId, s.assets), ...p.sourceIds.map((x) => `source ${x}`)], reasons, status: reasons.length ? "fail" : "pass" });
  }
  for (const id of s.panoramaAssetIds) {
    if (!s.assets.some((a) => a.id === id)) { items.push({ type: "panorama", id, trace: [], status: "unavailable", reasons: ["panorama image is absent"] }); continue; }
    const r = checkPublicCopy(id, s.assets);
    items.push({ type: "panorama", id, trace: chain(id, s.assets), reasons: r.ok ? [] : r.reasons, status: r.ok ? "pass" : "fail" });
  }
  for (const st of s.stories) {
    const problems = storyBlockers(st, { latestRevision: s.latestStoryRevision[st.id] ?? st.revision });
    items.push({ type: "story", id: st.id, trace: st.blocks.map((b) => `${b.kind} ${b.id}`), reasons: problems.map((p) => `${p.blockId}: ${p.reason}`), status: problems.length ? "fail" : "pass" });
  }
  const counts: Record<AuditStatus, number> = { pass: 0, fail: 0, unavailable: 0 };
  for (const i of items) counts[i.status]++;
  return {
    verdict: counts.fail === 0 ? "PASS" : "FAIL", items, counts,
    // unavailable items are simply not published; only passing items are
    publishable: items.filter((i) => i.status === "pass").map((i) => ({ type: i.type, id: i.id })),
  };
}
