import { describe, expect, it } from "vitest";
import type { Claim, Pair } from "./history.js";
import type { MediaAsset } from "./media.js";
import { canApprove, checklist, type ReviewItem } from "./review.js";

const LOC = "00000000-0000-4000-8000-000000000001"; // synthetic
const claim = (o: Partial<Claim> = {}): Claim => ({
  id: "c1", locationId: LOC, text: "Synthetic event.", sourceId: "s1", citation: "Invented citation", creator: "Author", sourceType: "primary", accessedOn: "2026-01-01",
  date: { value: "1990", precision: "year" }, geographicRelevance: "exact", rights: "open_licence", quality: "medium",
  verification: "unverified", verifiedBy: null, verifiedOn: null, corroboratedBy: [], enteredBy: "eve", ...o,
});
const claimItem = (o: Partial<Claim> = {}, extra: Partial<Extract<ReviewItem, { kind: "claim" }>> = {}): ReviewItem => ({ kind: "claim", id: "r1", claim: claim(o), submittedBy: "eve", ...extra });
const asset = (id: string, o: Partial<MediaAsset> = {}): MediaAsset => ({
  id, locationId: LOC, derivedFrom: null, transform: [], creator: "Synthetic Photographer", capturedOn: { value: "1990", precision: "year" }, directionDeg: 90, originalSourceRef: "src",
  rights: "cc_by", consent: "not_applicable", containsIdentifiablePeople: false, publicationPermitted: true, withdrawn: false, exifStripped: true, reviewRedaction: "not_needed",
  altText: "Synthetic photo", credit: "Synthetic credit", publicUrl: `https://img.invalid/derivatives/${id}.webp`, ...o,
});
const pair = (id: string, o: Partial<MediaAsset> = {}): MediaAsset[] => [asset(`${id}-orig`, { publicUrl: null, altText: null, credit: null, exifStripped: false, ...o }), asset(id, { derivedFrom: `${id}-orig`, transform: ["resize"], ...o })];
const mediaItem = (assets: MediaAsset[], id = "m1", extra = {}): ReviewItem => ({ kind: "media", id: "r2", assetId: id, assets, submittedBy: "eve", ...extra });
const pairItem = (assets: MediaAsset[], o: Partial<Pair> = {}): ReviewItem => ({
  kind: "pair", id: "r3", assets, submittedBy: "eve",
  pair: {
    id: "p1", locationId: LOC,
    before: { assetId: "before", locationId: LOC, date: { value: "1990", precision: "year" }, dateVerifiedBy: "rita", uploadedBy: "eve" },
    after: { assetId: "after", locationId: LOC, date: { value: "2026", precision: "year" }, dateVerifiedBy: "sam", uploadedBy: "eve" },
    viewpointNote: "Same corner", claimsMatchedViewpoint: true, sourceIds: ["s1"], verifiedSourceIds: ["s1"], ...o,
  },
});
const goodAssets = [...pair("before"), ...pair("after", { capturedOn: { value: "2026", precision: "year" } })];

describe("the lead sees the five checks", () => {
  it("a clean claim passes date, source, permission; viewpoint and redaction do not apply; no attribution claimed", () => {
    const c = checklist(claimItem());
    expect(c).toMatchObject({ date: { state: "pass" }, source: { state: "pass" }, permission: { state: "pass" }, viewpoint: { state: "na" }, redaction: { state: "na" }, attribution: { state: "na" } });
    expect(canApprove(claimItem(), "lead")).toEqual({ ok: true });
  });
  it("a clean pair passes everything including viewpoint and redaction", () => {
    const c = checklist(pairItem(goodAssets));
    for (const k of ["date", "source", "viewpoint", "permission", "redaction"] as const) expect(c[k].state, k).toBe("pass");
    expect(canApprove(pairItem(goodAssets), "lead")).toEqual({ ok: true });
  });
});

describe("unknown rights, unverified official attribution or a missing date blocks the item", () => {
  it("missing date", () => {
    const r = canApprove(claimItem({ date: { value: null, precision: null } }), "lead");
    expect(r).toEqual({ ok: false, blockers: ["date: no known date"] });
    const m = canApprove(mediaItem([...pair("m1", { capturedOn: { value: null, precision: null } })]), "lead");
    expect(m.ok).toBe(false);
    expect(!m.ok && m.blockers.join()).toContain("capture date unknown");
  });
  it("unknown or reserved rights, for claims and media", () => {
    for (const rights of ["unknown", "all_rights_reserved"] as const) {
      expect(canApprove(claimItem({ rights }), "lead")).toMatchObject({ ok: false });
      const m = canApprove(mediaItem(pair("m1", { rights })), "lead");
      expect(!m.ok && m.blockers.join()).toContain(`rights are "${rights}"`);
    }
  });
  it("unverified official attribution needs both evidence and scope", () => {
    for (const official of [{ claimed: true, verificationEvidence: null, scope: null }, { claimed: true, verificationEvidence: "letter on file", scope: null }, { claimed: true, verificationEvidence: "  ", scope: "ward office" }]) {
      const r = canApprove(claimItem({}, { official }), "lead");
      expect(r.ok).toBe(false);
      expect(!r.ok && r.blockers.join()).toContain("official attribution is unverified");
    }
    expect(canApprove(claimItem({}, { official: { claimed: true, verificationEvidence: "letter on file", scope: "ward office statement on 2026-03" } }), "lead")).toEqual({ ok: true });
    expect(canApprove(claimItem({}, { official: { claimed: false, verificationEvidence: null, scope: null } }), "lead")).toEqual({ ok: true });
  });
});

describe("permission, redaction and viewpoint", () => {
  it("withdrawn consent, research-only consent and withdrawn assets block", () => {
    for (const o of [{ consent: "withdrawn" as const }, { consent: "research_only" as const }, { publicationPermitted: false }, { withdrawn: true }]) {
      expect(canApprove(mediaItem(pair("m1", o)), "lead").ok, JSON.stringify(o)).toBe(false);
    }
  });
  it("identifiable people need granted consent and a finished redaction review; EXIF must be stripped", () => {
    const people = { containsIdentifiablePeople: true, consent: "granted" as const };
    const pending = checklist(mediaItem(pair("m1", { ...people, reviewRedaction: "pending" })));
    expect(pending.redaction).toMatchObject({ state: "fail" });
    expect(pending.redaction.reasons[0]).toContain("redaction review not done");
    expect(checklist(mediaItem(pair("m1", { ...people, reviewRedaction: "done" }))).redaction.state).toBe("pass");
    expect(checklist(mediaItem(pair("m1", { ...people, consent: "not_applicable", reviewRedaction: "done" }))).permission.state).toBe("fail");
    expect(checklist(mediaItem(pair("m1", { exifStripped: false }))).redaction.reasons.join()).toContain("EXIF");
  });
  it("a pair needs a viewpoint statement and a verified, independent date on each side", () => {
    expect(checklist(pairItem(goodAssets, { viewpointNote: "", claimsMatchedViewpoint: true })).viewpoint.state).toBe("fail");
    expect(checklist(pairItem(goodAssets, { viewpointNote: "", claimsMatchedViewpoint: false })).viewpoint.reasons).toEqual(["no viewpoint statement recorded"]);
    expect(checklist(pairItem(goodAssets, { before: { assetId: "before", locationId: LOC, date: { value: "1990", precision: "year" }, dateVerifiedBy: "eve", uploadedBy: "eve" } })).date.reasons).toContain("before date verified by the uploader");
    expect(checklist(pairItem(goodAssets, { after: { assetId: "after", locationId: "other", date: { value: "2026", precision: "year" }, dateVerifiedBy: "sam", uploadedBy: "eve" } })).viewpoint.reasons).toContain("after image is from a different place");
  });
  it("an oral account without corroboration cannot be approved for the chronology", () => {
    const r = canApprove(claimItem({ sourceType: "oral" }), "lead");
    expect(r.ok).toBe(false);
  });
});

describe("independence and consistency with publication", () => {
  it("the submitter cannot approve their own item", () => {
    expect(canApprove(claimItem(), "eve")).toEqual({ ok: false, blockers: ["approver must differ from the person who submitted the item"] });
  });
  it("a dangling asset or lineage error is a failure, never a pass", () => {
    const r = canApprove(mediaItem([asset("m1", { derivedFrom: "missing" })]), "lead");
    expect(r.ok).toBe(false);
  });
  it("approval is never easier than publication: anything the pair publication rule rejects is reported here too", () => {
    const bad = pairItem(goodAssets, { sourceIds: ["s9"], verifiedSourceIds: [] });
    const r = canApprove(bad, "lead");
    expect(r.ok).toBe(false);
  });
});
