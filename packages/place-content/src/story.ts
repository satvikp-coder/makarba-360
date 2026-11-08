/**
 * Verified location stories (#71). A story is an ordered list of blocks, each of one kind that is always labelled for the reader:
 *  - fact:     a statement checked by a reviewer against a verified source;
 *  - memory:   what a person said, with that person's separate permission to publish and to be attributed (or not);
 *  - official: a statement attributed to a named body, with written verification evidence and its scope.
 * The three are never merged into one voice. A revoked permission or an unverified official claim keeps the block (and the
 * story) unpublished. Pure rules over synthetic records; no real accounts exist.
 */
export type Attribution = "none" | "anonymous_role" | "named";
export interface FactBlock { kind: "fact"; id: string; text: string; sourceId: string | null; sourceVerified: boolean; verifiedBy: string | null; enteredBy: string }
export interface MemoryBlock {
  kind: "memory"; id: string; quote: string; period: string | null;          // when the person says it happened, as they said it
  consentPublish: "granted" | "not_requested" | "withdrawn"; quoteConsentRecorded: boolean;
  attributionPermitted: Attribution; roleLabel: string | null; displayName: string | null;
  containsIdentifyingDetail: boolean; identifyingDetailReviewed: boolean;
}
export interface OfficialBlock { kind: "official"; id: string; text: string; body: string | null; verificationEvidence: string | null; scope: string | null; statementDate: string | null }
export type Block = FactBlock | MemoryBlock | OfficialBlock;
export interface Story { id: string; locationId: string; revision: number; title: string; blocks: Block[]; authorId: string; reviewedBy: string | null; state: "draft" | "reviewed" | "published" | "withdrawn" }

export interface BlockProblem { blockId: string; reason: string }

export function blockProblems(b: Block): string[] {
  const why: string[] = [];
  if (b.kind === "fact") {
    if (!b.text.trim()) why.push("empty text");
    if (!b.sourceId || !b.sourceVerified) why.push("fact has no verified source");
    if (!b.verifiedBy) why.push("fact has no reviewer");
    else if (b.verifiedBy === b.enteredBy) why.push("fact was verified by the person who entered it");
  } else if (b.kind === "memory") {
    if (!b.quote.trim()) why.push("empty quote");
    if (b.consentPublish !== "granted") why.push(`permission to publish is "${b.consentPublish}"`);
    if (!b.quoteConsentRecorded) why.push("quote consent not recorded");
    if (b.attributionPermitted === "named" && !b.displayName?.trim()) why.push("named attribution permitted but no name recorded");
    if (b.attributionPermitted === "anonymous_role" && !b.roleLabel?.trim()) why.push("anonymous attribution needs a role label");
    if (b.containsIdentifyingDetail && !b.identifyingDetailReviewed) why.push("identifying details have not been reviewed");
  } else {
    if (!b.text.trim()) why.push("empty text");
    if (!b.body?.trim()) why.push("official statement names no body");
    if (!b.verificationEvidence?.trim() || !b.scope?.trim()) why.push("official claim is unverified: evidence and scope are required");
    if (!b.statementDate?.trim()) why.push("official statement has no date");
  }
  return why;
}

export function storyBlockers(s: Story, ctx: { latestRevision: number }): BlockProblem[] {
  const out: BlockProblem[] = [];
  if (s.revision !== ctx.latestRevision) out.push({ blockId: "-", reason: `stale revision ${s.revision}; latest is ${ctx.latestRevision}` });
  if (s.state !== "reviewed") out.push({ blockId: "-", reason: `story state is "${s.state}"; only "reviewed" stories can be published` });
  if (!s.reviewedBy) out.push({ blockId: "-", reason: "story has no reviewer" });
  else if (s.reviewedBy === s.authorId) out.push({ blockId: "-", reason: "story reviewer must differ from its author" });
  if (!s.blocks.length) out.push({ blockId: "-", reason: "story has no content" });
  const ids = new Set<string>();
  for (const b of s.blocks) {
    if (ids.has(b.id)) out.push({ blockId: b.id, reason: "duplicate block id" });
    ids.add(b.id);
    for (const r of blockProblems(b)) out.push({ blockId: b.id, reason: r });
  }
  return out;
}

/** Revoking a quote's permission makes the story unpublishable until the block is removed and the story is re-reviewed. */
export function revokeMemory(s: Story, blockId: string): Story {
  return { ...s, state: s.state === "published" ? "withdrawn" : s.state, blocks: s.blocks.map((b) => (b.kind === "memory" && b.id === blockId ? { ...b, consentPublish: "withdrawn" as const } : b)) };
}
/** Removing blocks creates a new draft revision that needs review again. */
export function removeBlock(s: Story, blockId: string): Story {
  return { ...s, revision: s.revision + 1, state: "draft", reviewedBy: null, blocks: s.blocks.filter((b) => b.id !== blockId) };
}

const LABEL = { fact: "Verified fact", memory: "What a person remembers", official: "Official statement" } as const;
export type PublicBlock =
  | { label: "Verified fact"; text: string }
  | { label: "What a person remembers"; quote: string; period: string | null; attribution: string | null }
  | { label: "Official statement"; text: string; body: string; statementDate: string; scope: string };

/** Public form: always labelled, attribution only as permitted, no reviewer/author/consent data. Null when the story cannot be published. */
export function toPublicStory(s: Story, ctx: { latestRevision: number }): { title: string; blocks: PublicBlock[] } | null {
  if (s.state === "published" ? storyBlockers({ ...s, state: "reviewed" }, ctx).length : true) return null;
  return {
    title: s.title,
    blocks: s.blocks.map((b): PublicBlock => {
      if (b.kind === "fact") return { label: LABEL.fact, text: b.text };
      if (b.kind === "official") return { label: LABEL.official, text: b.text, body: b.body!, statementDate: b.statementDate!, scope: b.scope! };
      const attribution = b.attributionPermitted === "named" ? b.displayName!.trim() : b.attributionPermitted === "anonymous_role" ? b.roleLabel!.trim() : null;
      return { label: LABEL.memory, quote: b.quote, period: b.period, attribution };
    }),
  };
}
