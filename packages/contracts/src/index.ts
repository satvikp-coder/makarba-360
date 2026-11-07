import { z } from "zod";

/**
 * Public DTO contract v1.0.0 (see docs/project/developer-handoffs.md).
 * Runtime validation is the source of truth; every schema is strict so unknown
 * fields (including private ones) are rejected rather than passed through.
 */
export const CONTRACT_VERSION = "1.0.0" as const;

/** Field names (normalised to lowercase letters) that must never appear in a public payload. */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "interviewid", "interviewpositions", "interviewlatitude", "interviewlongitude", "gpsaccuracym",
  "researcherid", "consentrecords", "rawanswers", "answers", "originalkey", "privateurl", "phone",
  "participantname", "exactinterviewtimestamp",
] as const;

export function findForbiddenField(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findForbiddenField(v, `${path}[${i}]`);
      if (hit) return hit;
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((FORBIDDEN_PUBLIC_FIELDS as readonly string[]).includes(k.toLowerCase().replace(/[^a-z]/g, ""))) {
        return `${path}.${k}`;
      }
      const hit = findForbiddenField(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

export const Meta = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  datasetKind: z.enum(["synthetic", "approved"]),
  snapshotId: z.string().min(1),
  methodologyUrl: z.string().min(1),
}).strict();

const lon = z.number().finite().min(-180).max(180);
const lat = z.number().finite().min(-90).max(90);
const position = z.tuple([lon, lat]);
const ring = z.array(position).min(4).refine((r) => {
  const a = r[0]!, b = r[r.length - 1]!;
  return a[0] === b[0] && a[1] === b[1];
}, "polygon ring must be closed");

export const Geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }).strict(),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(position).min(2)).min(1) }).strict(),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(ring).min(1)).min(1) }).strict(),
]);

export const LocationFeature = z.object({
  type: z.literal("Feature"),
  id: z.string().uuid(),
  geometry: Geometry,
  properties: z.object({
    locationId: z.string().uuid(),
    slug: z.string().min(1),
    name: z.record(z.string()).or(z.string()),
    category: z.string().min(1),
    publicationState: z.literal("published"),
    lastReviewedDate: z.string().min(1),
    sourceIds: z.array(z.string()),
    mediaIds: z.array(z.string()),
  }).strict(),
}).strict().refine((f) => f.id === f.properties.locationId, "Feature.id must equal properties.locationId");

export const LocationCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(LocationFeature),
  page: z.object({ limit: z.number().int().min(1).max(200), nextCursor: z.string().nullable() }).strict(),
  meta: Meta,
}).strict().refine((c) => new Set(c.features.map((f) => f.id)).size === c.features.length, "duplicate feature id");

const count = z.object({ code: z.string().optional(), value: z.union([z.string(), z.number()]).optional(), count: z.number().int().min(0) }).passthrough();

export const Cohort = z.object({
  cohortId: z.string().min(1),
  suppressed: z.boolean(),
  n: z.number().int().nullable(),
  validAnswerN: z.number().int().nullable(),
  missingN: z.number().int().nullable(),
  unsureN: z.number().int().nullable(),
  respondentCategories: z.array(count),
  ratings: z.array(count),
  issues: z.array(count),
  denominatorLabel: z.string().optional(),
  countingRule: z.string().optional(),
  reasonCode: z.string().optional(),
}).strict().superRefine((c, ctx) => {
  const bad = (m: string) => ctx.addIssue({ code: "custom", message: m });
  if (c.suppressed) {
    if ([c.n, c.validAnswerN, c.missingN, c.unsureN].some((v) => v !== null)) bad("suppressed cohort leaks counts");
    if ([c.respondentCategories, c.ratings, c.issues].some((a) => a.length)) bad("suppressed cohort leaks detail");
    if (!c.reasonCode) bad("suppression reason missing");
    return;
  }
  const { n, validAnswerN: v, missingN: m, unsureN: u } = c;
  if (n === null || v === null || m === null || u === null) return bad("counts missing");
  if (n < 5) bad("cohort below provisional k5 threshold");
  if (v + m + u > n) bad("valid+missing+unsure exceed distinct base");
  if (!c.denominatorLabel || !c.countingRule) bad("counting metadata missing");
  if (c.ratings.reduce((s, r) => s + r.count, 0) !== v) bad("rating denominator mismatch");
});

export const Insights = z.object({
  cohorts: z.array(Cohort),
  collectionPeriod: z.object({ fromMonth: z.string(), throughMonth: z.string() }).strict(),
  questionVersion: z.string(),
  policyVersion: z.string(),
  sampleNote: z.string().min(1),
  meta: Meta,
}).strict();

export const ApiError = z.object({
  code: z.string(), message: z.string(), fieldErrors: z.record(z.string()),
  requestId: z.string(), retryable: z.boolean(),
}).strict();

const dated = z.object({ value: z.string().nullable(), precision: z.string() }).passthrough();
const datedRequired = z.object({ value: z.string().min(1), precision: z.string() }).passthrough();

export const History = z.object({
  locationId: z.string().uuid(),
  sources: z.array(z.object({ id: z.string(), citation: z.string(), url: z.string(), licence: z.string(), verificationState: z.string() }).strict()),
  events: z.array(z.object({ id: z.string(), sourceId: z.string(), date: dated, evidenceType: z.string(), text: z.string() }).strict()),
  comparisonPairs: z.array(z.object({
    id: z.string(), locationId: z.string().uuid(), beforeMediaId: z.string(), afterMediaId: z.string(),
    beforeDate: datedRequired, afterDate: datedRequired, sourceIds: z.array(z.string()).min(1),
    matchingViewpointNotes: z.string(), evidenceQuality: z.string(),
  }).strict()),
  meta: Meta,
}).strict();

export const Media = z.object({
  id: z.string(), locationId: z.string().uuid(),
  url: z.string().startsWith("https://").refine((u) => !u.includes("/original/"), "original media is private"),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive(), height: z.number().int().positive(),
  format: z.enum(["image", "equirectangular", "multiresolution"]),
  alt: z.string().min(1), credit: z.string(), licence: z.string(), capturedDate: dated,
  publicationState: z.literal("published"), staticFallbackUrl: z.string(), meta: Meta,
}).strict();

export type LocationCollection = z.infer<typeof LocationCollection>;
export type Insights = z.infer<typeof Insights>;
export type History = z.infer<typeof History>;
export type Media = z.infer<typeof Media>;
export type ApiError = z.infer<typeof ApiError>;

export const SCHEMAS = { locations: LocationCollection, insights: Insights, history: History, media: Media, error: ApiError } as const;
export type ContractKind = keyof typeof SCHEMAS;

/** Validate a public payload: forbidden private fields are rejected before schema parsing. */
export function validatePublic(kind: ContractKind, value: unknown): { ok: true } | { ok: false; error: string } {
  const hit = findForbiddenField(value);
  if (hit) return { ok: false, error: `restricted public field ${hit}` };
  const r = SCHEMAS[kind].safeParse(value);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
