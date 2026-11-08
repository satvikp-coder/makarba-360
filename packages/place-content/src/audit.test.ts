import { describe, expect, it } from "vitest";
import { auditPublication, type PublicationSnapshot } from "./audit.js";
import type { Claim, Pair } from "./history.js";
import type { MediaAsset } from "./media.js";
import type { Story } from "./story.js";

const LOC = "00000000-0000-4000-8000-000000000001"; // synthetic
const asset = (id: string, o: Partial<MediaAsset> = {}): MediaAsset => ({
  id, locationId: LOC, derivedFrom: null, transform: [], creator: "Synthetic Photographer", capturedOn: { value: "1990", precision: "year" }, directionDeg: 90, originalSourceRef: "src",
  rights: "cc_by", consent: "not_applicable", containsIdentifiablePeople: false, publicationPermitted: true, withdrawn: false, exifStripped: true, reviewRedaction: "not_needed",
  altText: "Synthetic photo", credit: "Synthetic credit", publicUrl: `https://img.invalid/derivatives/${id}.webp`, ...o,
});
const withOriginal = (id: string, o: Partial<MediaAsset> = {}): MediaAsset[] => [asset(`${id}-orig`, { publicUrl: null, altText: null, credit: null, exifStripped: false, ...o }), asset(id, { derivedFrom: `${id}-orig`, transform: ["resize"], ...o })];
const claim = (o: Partial<Claim> = {}): Claim => ({ id: "c1", locationId: LOC, text: "t", sourceId: "s1", citation: "Invented citation", creator: "A", sourceType: "primary", accessedOn: "2026-01-01", date: { value: "1990", precision: "year" }, geographicRelevance: "exact", rights: "open_licence", quality: "medium", verification: "verified", verifiedBy: "rita", verifiedOn: "2026-02-01", corroboratedBy: [], enteredBy: "eve", ...o });
const pair = (o: Partial<Pair> = {}): Pair => ({
  id: "p1", locationId: LOC,
  before: { assetId: "before", locationId: LOC, date: { value: "1990", precision: "year" }, dateVerifiedBy: "rita", uploadedBy: "eve" },
  after: { assetId: "after", locationId: LOC, date: { value: "2026", precision: "year" }, dateVerifiedBy: "sam", uploadedBy: "eve" },
  viewpointNote: "Same corner", claimsMatchedViewpoint: true, sourceIds: ["s1"], verifiedSourceIds: ["s1"], ...o,
});
const story = (o: Partial<Story> = {}): Story => ({ id: "st1", locationId: LOC, revision: 1, title: "t", authorId: "eve", reviewedBy: "rita", state: "reviewed", blocks: [{ kind: "fact", id: "f1", text: "x", sourceId: "s1", sourceVerified: true, verifiedBy: "rita", enteredBy: "eve" }], ...o });
const good = (): PublicationSnapshot => ({
  claims: [claim()], pairs: [pair()], panoramaAssetIds: ["pano"], stories: [story()], latestStoryRevision: { st1: 1 },
  assets: [...withOriginal("before"), ...withOriginal("after", { capturedOn: { value: "2026", precision: "year" } }), ...withOriginal("pano")],
});
const statusOf = (r: ReturnType<typeof auditPublication>, type: string, id: string) => r.items.find((i) => i.type === type && i.id === id)!;

describe("publication audit", () => {
  it("a fully evidenced snapshot passes and lists every item as publishable, with its trace back to the original", () => {
    const r = auditPublication(good());
    expect(r.verdict).toBe("PASS");
    expect(r.counts).toEqual({ pass: 4, fail: 0, unavailable: 0 });
    expect(r.publishable).toHaveLength(4);
    expect(statusOf(r, "panorama", "pano").trace).toEqual(["pano", "pano-orig"]);
    expect(statusOf(r, "pair", "p1").trace).toEqual(expect.arrayContaining(["before", "before-orig", "after", "after-orig", "source s1"]));
  });
  it("absent historical image or date makes the feature unavailable, not a failure, and it is not publishable", () => {
    const s = good();
    s.assets = s.assets.filter((a) => !a.id.startsWith("before"));
    const r = auditPublication(s);
    expect(statusOf(r, "pair", "p1")).toMatchObject({ status: "unavailable", reasons: ["image before is absent"] });
    expect(r.publishable.some((p) => p.id === "p1")).toBe(false);
    expect(r.verdict).toBe("PASS");                               // hiding the feature is the correct outcome
    const s2 = good(); s2.pairs = [pair({ before: { ...pair().before, date: { value: null, precision: null } } })];
    expect(statusOf(auditPublication(s2), "pair", "p1")).toMatchObject({ status: "unavailable", reasons: ["a historical date is absent"] });
    const s3 = good(); s3.claims = [claim({ date: { value: null, precision: null } })];
    expect(statusOf(auditPublication(s3), "claim", "c1").status).toBe("unavailable");
    const s4 = good(); s4.panoramaAssetIds = ["ghost"];
    expect(statusOf(auditPublication(s4), "panorama", "ghost")).toMatchObject({ status: "unavailable", reasons: ["panorama image is absent"] });
  });
  it("missing rights, permission or sources fail the audit, with reasons, and the item is not publishable", () => {
    const s = good();
    s.assets = [...withOriginal("before", { rights: "unknown" }), ...withOriginal("after", { capturedOn: { value: "2026", precision: "year" } }), ...withOriginal("pano", { consent: "withdrawn" })];
    s.claims = [claim({ rights: "unknown" })];
    s.stories = [story({ reviewedBy: null })];
    const r = auditPublication(s);
    expect(r.verdict).toBe("FAIL");
    expect(r.counts.fail).toBe(4);
    expect(statusOf(r, "pair", "p1").reasons.join()).toMatch(/before image: rights are "unknown"/);
    expect(statusOf(r, "panorama", "pano").reasons.join()).toMatch(/consent withdrawn/);
    expect(statusOf(r, "claim", "c1").reasons).toContain('rights are "unknown"');
    expect(statusOf(r, "story", "st1").reasons).toContain("-: story has no reviewer");
    expect(r.publishable).toEqual([]);
  });
  it("a quote whose permission is withdrawn fails the story", () => {
    const s = good();
    s.stories = [story({ blocks: [{ kind: "memory", id: "m1", quote: "q", period: null, consentPublish: "withdrawn", quoteConsentRecorded: true, attributionPermitted: "none", roleLabel: null, displayName: null, containsIdentifyingDetail: false, identifyingDetailReviewed: false }] })];
    expect(statusOf(auditPublication(s), "story", "st1").reasons).toContain('m1: permission to publish is "withdrawn"');
  });
  it("a stale story revision fails; a broken derivative chain is reported in the trace", () => {
    const s = good(); s.latestStoryRevision = { st1: 2 };
    expect(statusOf(auditPublication(s), "story", "st1").reasons.join()).toMatch(/stale revision 1; latest is 2/);
    const b = good(); b.assets = [...b.assets.filter((a) => a.id !== "pano-orig")];
    const item = statusOf(auditPublication(b), "panorama", "pano");
    expect(item.status).toBe("fail");
    expect(item.trace[0]).toMatch(/broken/);
  });
  it("an empty snapshot passes with nothing publishable (no content is invented)", () => {
    const r = auditPublication({ claims: [], pairs: [], panoramaAssetIds: [], stories: [], assets: [], latestStoryRevision: {} });
    expect(r).toMatchObject({ verdict: "PASS", items: [], publishable: [] });
  });
});
