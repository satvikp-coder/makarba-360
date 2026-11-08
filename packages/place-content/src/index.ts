import { z } from "zod";

/**
 * Versioned place content (#63). Two kinds of content are kept apart so neither can stand in for the other:
 *  - description: editorial text about the place (makes no historical claim)
 *  - observation: a dated statement (researcher observation, respondent account or historical claim)
 * Each carries its own evidence state. Map geometry approval is a different record entirely: approving a
 * place's shape NEVER approves its content. `checkPublishable` deliberately accepts no geometry input.
 */
export const CONTENT_STATES = ["candidate", "reviewed", "approved", "published", "archived", "withdrawn"] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

export const DATE_PRECISIONS = ["day", "month", "year", "decade", "approximate"] as const;
export const EVIDENCE_KINDS = ["researcher_observation", "respondent_account", "historical_claim", "reviewer_checked_fact"] as const;
export const EVIDENCE_QUALITY = ["unrated", "low", "medium", "high"] as const;

const dated = z.object({
  value: z.string().min(1).nullable(), // null = unknown, never a guessed year
  precision: z.enum(DATE_PRECISIONS).nullable(),
}).strict().superRefine((d, ctx) => {
  if ((d.value === null) !== (d.precision === null)) ctx.addIssue({ code: "custom", message: "date value and precision must both be set or both be null" });
});

export const ContentRevision = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  kind: z.enum(["description", "observation"]),
  revision: z.number().int().min(1),
  state: z.enum(CONTENT_STATES),
  body: z.string().min(1).max(4000),
  /** Required for observations; a description makes no dated claim. */
  observedOn: dated,
  evidenceKind: z.enum(EVIDENCE_KINDS).nullable(),
  evidenceQuality: z.enum(EVIDENCE_QUALITY),
  sourceIds: z.array(z.string().min(1)),
  /** Quotes need their own consent, independent of everything else. */
  containsQuote: z.boolean(),
  quoteConsentRecorded: z.boolean(),
  rightsCleared: z.boolean(),
  authorId: z.string().min(1),
  reviewedBy: z.string().min(1).nullable(),
  reviewedAt: z.string().datetime().nullable(),
  lastReviewedAt: z.string().datetime().nullable(),
  supersedes: z.number().int().min(1).nullable(),
}).strict();
export type ContentRevision = z.infer<typeof ContentRevision>;

/** Verification of the map shape. A separate record with no bearing on content publication. */
export const GeometryApproval = z.object({
  locationId: z.string().uuid(),
  geometryRevision: z.number().int().min(1),
  state: z.enum(["candidate", "reviewed", "approved", "withdrawn"]),
}).strict();
export type GeometryApproval = z.infer<typeof GeometryApproval>;

export type SourceRef = { id: string; verificationState: "unverified" | "verified" | "withdrawn" };

const ALLOWED: Record<ContentState, ContentState[]> = {
  candidate: ["reviewed", "withdrawn", "archived"],
  reviewed: ["approved", "candidate", "withdrawn", "archived"],
  approved: ["published", "reviewed", "withdrawn", "archived"],
  published: ["archived", "withdrawn"], // immutable once published: edits create a new revision
  archived: [],
  withdrawn: [],
};
export function canTransition(from: ContentState, to: ContentState): boolean { return ALLOWED[from].includes(to); }

export type Check = { ok: true } | { ok: false; reasons: string[] };

/** Whether a revision may be published. `latestRevision` blocks publishing a stale revision. */
export function checkPublishable(c: ContentRevision, ctx: { sources: SourceRef[]; latestRevision: number }): Check {
  const why: string[] = [];
  if (c.state !== "approved") why.push(`content state is "${c.state}"; only "approved" content can be published`);
  if (!c.reviewedBy || !c.reviewedAt) why.push("no recorded content review");
  if (c.reviewedBy && c.reviewedBy === c.authorId) why.push("reviewer must differ from author");
  if (c.revision !== ctx.latestRevision) why.push(`stale revision ${c.revision}; latest is ${ctx.latestRevision}`);
  if (!c.rightsCleared) why.push("rights not cleared");
  if (c.containsQuote && !c.quoteConsentRecorded) why.push("quote consent not recorded");
  if (c.kind === "observation") {
    if (c.observedOn.value === null) why.push("observation has no known date");
    if (!c.evidenceKind) why.push("observation has no evidence kind");
    if (c.sourceIds.length === 0) why.push("observation cites no source");
  }
  const byId = new Map(ctx.sources.map((s) => [s.id, s]));
  for (const id of c.sourceIds) {
    const s = byId.get(id);
    if (!s) why.push(`source ${id} not found`);
    else if (s.verificationState === "withdrawn") why.push(`source ${id} is withdrawn`);
    else if (c.kind === "observation" && s.verificationState !== "verified") why.push(`source ${id} is not verified`);
  }
  return why.length ? { ok: false, reasons: why } : { ok: true };
}

/** A published revision is never changed; an edit yields a new candidate revision with review cleared. */
export function reviseContent(prev: ContentRevision, patch: { body?: string; observedOn?: ContentRevision["observedOn"]; sourceIds?: string[] }, author: string): ContentRevision {
  if (prev.state === "withdrawn" || prev.state === "archived") throw new Error(`cannot revise ${prev.state} content`);
  return ContentRevision.parse({
    ...prev, ...patch, id: crypto.randomUUID(), revision: prev.revision + 1, state: "candidate", authorId: author,
    reviewedBy: null, reviewedAt: null, supersedes: prev.revision,
  });
}

/** Only approved, still-valid published content leaves the editing model; author and reviewer identity never do. */
export function toPublicContent(c: ContentRevision, sources: SourceRef[], latestRevision: number) {
  if (c.state !== "published") return null;
  const chk = checkPublishable({ ...c, state: "approved" }, { sources, latestRevision });
  if (!chk.ok) return null;
  return { id: c.id, kind: c.kind, locale: c.locale, body: c.body, observedOn: c.observedOn, evidenceKind: c.evidenceKind, evidenceQuality: c.evidenceQuality, sourceIds: c.sourceIds, lastReviewedAt: c.lastReviewedAt };
}
