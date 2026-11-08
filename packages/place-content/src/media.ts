import { z } from "zod";

/**
 * Photo provenance, rights and consent (#61). An asset is either a private original or a derivative of another
 * asset. Every derivative traces to its original, and rights/consent/withdrawal on the original govern every copy.
 * Unknown rights, missing consent or a withdrawal block the public copy; nothing is assumed.
 */
const dated = z.object({ value: z.string().min(1).nullable(), precision: z.enum(["day", "month", "year", "decade", "approximate"]).nullable() })
  .strict().superRefine((d, ctx) => { if ((d.value === null) !== (d.precision === null)) ctx.addIssue({ code: "custom", message: "date value and precision must both be set or both be null" }); });

export const RIGHTS = ["unknown", "public_domain", "cc_by", "cc_by_sa", "cc0", "licensed_to_project", "permission_granted", "all_rights_reserved"] as const;
export const CONSENT = ["not_applicable", "not_requested", "granted", "research_only", "withdrawn"] as const;

export const MediaAsset = z.object({
  id: z.string().min(1),
  locationId: z.string().uuid(),
  /** null = original (private). Otherwise the id of the asset this was derived from. */
  derivedFrom: z.string().min(1).nullable(),
  /** What was done: "resize", "crop", "strip_exif", "redact_faces", "redact_plates"... */
  transform: z.array(z.string()),
  creator: z.string().min(1).nullable(),
  capturedOn: dated,
  /** Camera bearing in degrees clockwise from north, if known. Never inferred. */
  directionDeg: z.number().min(0).lt(360).nullable(),
  originalSourceRef: z.string().min(1).nullable(),
  rights: z.enum(RIGHTS),
  consent: z.enum(CONSENT),
  /** Whether identifiable people appear and their consent covers publication. */
  containsIdentifiablePeople: z.boolean(),
  publicationPermitted: z.boolean(),
  withdrawn: z.boolean(),
  exifStripped: z.boolean(),
  reviewRedaction: z.enum(["not_needed", "pending", "done"]),
  altText: z.string().nullable(),
  credit: z.string().nullable(),
  publicUrl: z.string().nullable(),
}).strict();
export type MediaAsset = z.infer<typeof MediaAsset>;

export type Check = { ok: true } | { ok: false; reasons: string[] };

/** Walk to the original, guarding against missing parents and cycles. */
export function lineage(id: string, all: MediaAsset[]): { chain: MediaAsset[]; error: string | null } {
  const byId = new Map(all.map((a) => [a.id, a]));
  const chain: MediaAsset[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  if (!cur) return { chain, error: `asset ${id} not found` };
  while (cur) {
    if (seen.has(cur.id)) return { chain, error: "derivative cycle" };
    seen.add(cur.id); chain.push(cur);
    if (cur.derivedFrom === null) return { chain, error: null };
    const parent = byId.get(cur.derivedFrom);
    if (!parent) return { chain, error: `parent ${cur.derivedFrom} of ${cur.id} not found` };
    cur = parent;
  }
  return { chain, error: "unreachable" };
}

const OPEN_LICENCES = new Set<string>(["public_domain", "cc_by", "cc_by_sa", "cc0", "licensed_to_project", "permission_granted"]);

export function checkPublicCopy(id: string, all: MediaAsset[]): Check {
  const why: string[] = [];
  const { chain, error } = lineage(id, all);
  if (error) return { ok: false, reasons: [error] };
  const copy = chain[0]!;
  const original = chain[chain.length - 1]!;
  if (copy.derivedFrom === null) why.push("an original is never published; publish a reviewed derivative");
  // Rights, consent and withdrawal come from the original and every link: any one failing blocks the copy.
  for (const a of chain) {
    if (a.withdrawn) why.push(`${a.id} is withdrawn`);
    if (a.consent === "withdrawn") why.push(`consent withdrawn on ${a.id}`);
  }
  if (!OPEN_LICENCES.has(original.rights)) why.push(`rights are "${original.rights}"; cannot publish`);
  if (!original.publicationPermitted) why.push("publication not permitted for the original");
  if (original.containsIdentifiablePeople && original.consent !== "granted") why.push(`identifiable people with consent "${original.consent}"`);
  if (original.consent === "research_only" || original.consent === "not_requested") why.push(`consent is "${original.consent}"; cannot publish`);
  if (!original.creator) why.push("creator unknown");
  if (copy.capturedOn.value === null && original.capturedOn.value === null) why.push("capture date unknown");
  if (!copy.exifStripped) why.push("EXIF metadata not stripped on the public copy");
  if (original.containsIdentifiablePeople && copy.reviewRedaction !== "done") why.push("face/plate redaction review not done");
  if (!copy.altText) why.push("alt text missing");
  if (!copy.credit) why.push("credit missing");
  if (!copy.publicUrl || !copy.publicUrl.startsWith("https://") || copy.publicUrl.includes("/original/")) why.push("public URL missing or points at original storage");
  return why.length ? { ok: false, reasons: [...new Set(why)] } : { ok: true };
}

/** Withdrawing any asset withdraws it and every descendant; returns a new array (no mutation). */
export function withdraw(id: string, all: MediaAsset[]): MediaAsset[] {
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) { grew = false; for (const a of all) if (a.derivedFrom && doomed.has(a.derivedFrom) && !doomed.has(a.id)) { doomed.add(a.id); grew = true; } }
  return all.map((a) => (doomed.has(a.id) ? { ...a, withdrawn: true, publicationPermitted: false, publicUrl: null } : a));
}

/** Public fields only. Creator identity, source reference, bearing and consent details stay private. */
export function toPublicMedia(id: string, all: MediaAsset[]) {
  if (!checkPublicCopy(id, all).ok) return null;
  const copy = all.find((a) => a.id === id)!;
  const original = lineage(id, all).chain.at(-1)!;
  return {
    id: copy.id, locationId: copy.locationId, url: copy.publicUrl!, alt: copy.altText!, credit: copy.credit!,
    licence: original.rights, capturedDate: copy.capturedOn.value !== null ? copy.capturedOn : original.capturedOn,
  };
}
