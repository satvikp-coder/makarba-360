import { describe, expect, it } from "vitest";
import { canTransition, checkPublishable, ContentRevision, GeometryApproval, reviseContent, toPublicContent, type SourceRef } from "./index.js";

const LOC = "00000000-0000-4000-8000-000000000001"; // synthetic
const base = (o: Partial<ContentRevision> = {}): ContentRevision => ({
  id: "00000000-0000-4000-8000-0000000000a1", locationId: LOC, locale: "en", kind: "observation", revision: 1, state: "approved",
  body: "Synthetic observation text.", observedOn: { value: "2021", precision: "year" }, evidenceKind: "historical_claim", evidenceQuality: "medium",
  sourceIds: ["s1"], containsQuote: false, quoteConsentRecorded: false, rightsCleared: true, authorId: "alice", reviewedBy: "bob",
  reviewedAt: "2026-01-01T00:00:00Z", lastReviewedAt: "2026-01-01T00:00:00Z", supersedes: null, ...o,
});
const sources: SourceRef[] = [{ id: "s1", verificationState: "verified" }, { id: "s2", verificationState: "unverified" }, { id: "s3", verificationState: "withdrawn" }];
const reasons = (c: ContentRevision, latest = c.revision) => { const r = checkPublishable(c, { sources, latestRevision: latest }); return r.ok ? [] : r.reasons; };
const onlyApproved = expect.arrayContaining([expect.stringContaining('only "approved"')]);

describe("kinds are separate", () => {
  it("an approved dated observation with a verified source is publishable", () => { expect(reasons(base())).toEqual([]); });
  it("a description makes no dated claim and needs no date or evidence kind", () => {
    expect(reasons(base({ kind: "description", observedOn: { value: null, precision: null }, evidenceKind: null, sourceIds: [] }))).toEqual([]);
  });
  it("an observation with unknown date, no kind or no source is refused", () => {
    const r = reasons(base({ observedOn: { value: null, precision: null }, evidenceKind: null, sourceIds: [] }));
    expect(r).toEqual(expect.arrayContaining(["observation has no known date", "observation has no evidence kind", "observation cites no source"]));
  });
  it("a date value without precision is invalid (never an implied exact date)", () => {
    expect(ContentRevision.safeParse(base({ observedOn: { value: "2021", precision: null } })).success).toBe(false);
  });
});

describe("geometry approval never approves content", () => {
  it("unreviewed content stays unpublishable whatever the geometry state", () => {
    const geometry = GeometryApproval.parse({ locationId: LOC, geometryRevision: 3, state: "approved" });
    expect(geometry.state).toBe("approved");
    for (const state of ["candidate", "reviewed"] as const) {
      expect(reasons(base({ state, reviewedBy: null, reviewedAt: null }))).toEqual(onlyApproved);
    }
  });
  it("a content record has no geometry-approval field to inherit from", () => {
    expect(ContentRevision.safeParse({ ...base(), geometryApproved: true }).success).toBe(false);
  });
});

describe("independent publication requirements", () => {
  it("unreviewed, self-reviewed, unverified, withdrawn and missing sources are each refused", () => {
    expect(reasons(base({ reviewedBy: null, reviewedAt: null }))).toContain("no recorded content review");
    expect(reasons(base({ reviewedBy: "alice" }))).toContain("reviewer must differ from author");
    expect(reasons(base({ sourceIds: ["s2"] }))).toContain("source s2 is not verified");
    expect(reasons(base({ sourceIds: ["s3"] }))).toContain("source s3 is withdrawn");
    expect(reasons(base({ sourceIds: ["nope"] }))).toContain("source nope not found");
  });
  it("rights and quote consent are independent gates", () => {
    expect(reasons(base({ rightsCleared: false }))).toContain("rights not cleared");
    expect(reasons(base({ containsQuote: true }))).toContain("quote consent not recorded");
    expect(reasons(base({ containsQuote: true, quoteConsentRecorded: true }))).toEqual([]);
  });
  it("a stale revision cannot be published", () => { expect(reasons(base({ revision: 1 }), 2)).toContain("stale revision 1; latest is 2"); });
  it("published or withdrawn content is not re-publishable", () => {
    expect(reasons(base({ state: "published" }))).toEqual(onlyApproved);
    expect(reasons(base({ state: "withdrawn" }))).toEqual(onlyApproved);
  });
});

describe("lifecycle and versions", () => {
  it("published content is immutable: only archive or withdraw", () => {
    expect(canTransition("published", "candidate")).toBe(false);
    expect(canTransition("published", "approved")).toBe(false);
    expect(canTransition("published", "withdrawn")).toBe(true);
  });
  it("review cannot be skipped", () => {
    expect(canTransition("candidate", "approved")).toBe(false);
    expect(canTransition("candidate", "published")).toBe(false);
    expect(canTransition("reviewed", "published")).toBe(false);
  });
  it("withdrawn and archived are terminal", () => {
    for (const to of ["candidate", "reviewed", "approved", "published"] as const) {
      expect(canTransition("withdrawn", to)).toBe(false);
      expect(canTransition("archived", to)).toBe(false);
    }
  });
  it("editing creates a new candidate revision, clears review and keeps lineage", () => {
    const next = reviseContent(base({ state: "published" }), { body: "Changed." }, "carol");
    expect(next).toMatchObject({ revision: 2, state: "candidate", reviewedBy: null, reviewedAt: null, supersedes: 1, authorId: "carol" });
    expect(reasons(next)).toContain("no recorded content review");
  });
  it("withdrawn content cannot be revised back to life", () => { expect(() => reviseContent(base({ state: "withdrawn" }), {}, "x")).toThrow(/withdrawn/); });
});

describe("public projection", () => {
  it("only published, still-valid content is exposed, without author or reviewer", () => {
    const pub = base({ state: "published" });
    const p = toPublicContent(pub, sources, 1)!;
    expect(p).not.toBeNull();
    expect(JSON.stringify(p)).not.toMatch(/alice|bob|reviewedBy|authorId/);
    expect(toPublicContent(base({ state: "approved" }), sources, 1)).toBeNull();
    expect(toPublicContent(pub, [{ id: "s1", verificationState: "withdrawn" }], 1)).toBeNull(); // source later withdrawn
    expect(toPublicContent(pub, sources, 2)).toBeNull(); // superseded by a newer revision
  });
});
