import { describe, expect, it } from "vitest";
import { buildTimeline, chronologyBlockers, descriptionBlockers, pairBlockers, supportedRange, verifyClaim, type Claim, type DescriptionDraft, type Pair } from "./history.js";
import type { MediaAsset } from "./media.js";

const LOC = "00000000-0000-4000-8000-000000000001", OTHER = "00000000-0000-4000-8000-000000000002"; // synthetic
const claim = (o: Partial<Claim> = {}): Claim => ({
  id: "c1", locationId: LOC, text: "Synthetic event.", sourceId: "s1", citation: "Invented citation", creator: "Synthetic Author", sourceType: "primary", accessedOn: "2026-01-01",
  date: { value: "1990", precision: "year" }, geographicRelevance: "exact", rights: "open_licence", quality: "medium",
  verification: "verified", verifiedBy: "rita", verifiedOn: "2026-02-01", corroboratedBy: [], enteredBy: "eve", ...o,
});
const unverified = (o: Partial<Claim> = {}) => claim({ verification: "unverified", verifiedBy: null, verifiedOn: null, ...o });

describe("#65 provenance: what can stand as chronology", () => {
  it("a verified, sourced, dated, cleared, relevant, independently reviewed claim can", () => { expect(chronologyBlockers(claim())).toEqual([]); });
  it("each missing piece blocks with its own reason", () => {
    expect(chronologyBlockers(claim({ sourceId: null }))).toContain("no source citation");
    expect(chronologyBlockers(claim({ citation: "  " }))).toContain("no source citation");
    expect(chronologyBlockers(claim({ date: { value: null, precision: null } }))).toContain("no known date");
    expect(chronologyBlockers(claim({ rights: "unknown" }))).toContain('rights are "unknown"');
    expect(chronologyBlockers(claim({ rights: "all_rights_reserved" }))).toContain('rights are "all_rights_reserved"');
    expect(chronologyBlockers(claim({ geographicRelevance: "unclear" }))).toContain("relevance to this place is unclear");
    expect(chronologyBlockers(claim({ verifiedBy: null }))).toContain("no reviewer recorded");
    expect(chronologyBlockers(claim({ verifiedBy: "eve" }))).toContain("reviewer must differ from the person who entered the claim");
    for (const v of ["unverified", "disputed", "withdrawn"] as const) expect(chronologyBlockers(claim({ verification: v }))[0]).toContain(`"${v}"`);
  });
  it("an approximate date needs a stated earliest and latest", () => {
    expect(chronologyBlockers(claim({ date: { value: "c. 1950", precision: "approximate" } }))).toContain("approximate date has no stated earliest and latest");
    expect(chronologyBlockers(claim({ date: { value: "c. 1950", precision: "approximate", earliest: "1945-01-01", latest: "1955-12-31" } }))).toEqual([]);
  });
  it("a remembered account cannot become chronology without independent corroboration", () => {
    expect(chronologyBlockers(claim({ sourceType: "oral" }))[0]).toMatch(/needs an independent corroborating source/);
    expect(chronologyBlockers(claim({ sourceType: "oral", corroboratedBy: ["s9"] }))).toEqual([]);
  });
  it("verification is refused while the source or date is missing, and nobody verifies their own entry", () => {
    for (const o of [{ sourceId: null }, { citation: null }, { date: { value: null, precision: null } }] as Partial<Claim>[]) {
      const r = verifyClaim(unverified(o), "rita", "2026-02-01");
      expect(r.ok).toBe(false);
    }
    expect(verifyClaim(unverified(), "eve", "2026-02-01")).toMatchObject({ ok: false });
    const ok = verifyClaim(unverified(), "rita", "2026-02-01");
    expect(ok).toMatchObject({ ok: true, claim: { verification: "verified", verifiedBy: "rita" } });
  });
  it("an oral account can be verified as an account but still stays off the chronology", () => {
    const r = verifyClaim(unverified({ sourceType: "oral" }), "rita", "2026-02-01");
    expect(r.ok).toBe(true);
    const t = buildTimeline([(r as { claim: Claim }).claim], LOC);
    expect(t.entries).toEqual([]);
    expect(t.unplaced[0]!.reasons[0]).toMatch(/corroborating/);
  });
});

describe("#66 timeline", () => {
  it("ranges follow the stated precision and never use today's date", () => {
    expect(supportedRange({ value: "1990", precision: "year" })).toEqual({ from: "1990-01-01", to: "1990-12-31" });
    expect(supportedRange({ value: "2024-02", precision: "month" })).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(supportedRange({ value: "2023-02", precision: "month" })).toEqual({ from: "2023-02-01", to: "2023-02-28" });
    expect(supportedRange({ value: "1985-06-15", precision: "day" })).toEqual({ from: "1985-06-15", to: "1985-06-15" });
    expect(supportedRange({ value: "1970s", precision: "decade" })).toEqual({ from: "1970-01-01", to: "1979-12-31" });
    expect(supportedRange({ value: null, precision: null })).toBeNull();
    expect(supportedRange({ value: "1990", precision: null })).toBeNull();
  });
  it("a value that does not match its precision gives no range rather than a guess", () => {
    expect(supportedRange({ value: "1990", precision: "day" })).toBeNull();
    expect(supportedRange({ value: "1990-05", precision: "year" })).toBeNull();
    expect(supportedRange({ value: "c. 1950", precision: "approximate" })).toBeNull();
    expect(supportedRange({ value: "c. 1950", precision: "approximate", earliest: "1955-01-01", latest: "1945-01-01" })).toBeNull();
  });
  it("only verified chronology entries are placed, ordered by supported period, with ties broken by id", () => {
    const t = buildTimeline([
      claim({ id: "b", date: { value: "2001", precision: "year" } }), claim({ id: "a", date: { value: "1975", precision: "year" } }),
      claim({ id: "d", date: { value: "2001-06", precision: "month" } }), claim({ id: "c", date: { value: "2001", precision: "year" } }),
      unverified({ id: "u" }), claim({ id: "x", locationId: OTHER }),
    ], LOC);
    expect(t.entries.map((e) => e.claimId)).toEqual(["a", "b", "c", "d"]);
    expect(t.entries.map((e) => e.precision)).toEqual(["year", "year", "year", "month"]);
    expect(t.unplaced.map((u) => u.claimId)).toEqual(["u"]);
  });
  it("an undated claim is listed as unplaced, never given a year or today's date", () => {
    const t = buildTimeline([claim({ id: "n", date: { value: null, precision: null } })], LOC);
    expect(t.entries).toEqual([]);
    expect(JSON.stringify(t)).not.toMatch(/2026|2025/);
    expect(t.unplaced[0]!.reasons).toContain("no known date");
  });
  it("withdrawn claims vanish; disputed claims are listed as disputed and not placed", () => {
    const t = buildTimeline([claim({ id: "w", verification: "withdrawn" }), claim({ id: "p", verification: "disputed" })], LOC);
    expect(t.entries).toEqual([]);
    expect(t.unplaced.map((u) => u.claimId)).toEqual(["p"]);
    expect(t.unplaced.some((u) => u.claimId === "w")).toBe(false);
    expect(t.unplaced.some((u) => u.reasons.some((r) => r.startsWith("disputed")))).toBe(true);
  });
  it("carries the quality and the caution note", () => {
    const t = buildTimeline([claim({ quality: "high" })], LOC);
    expect(t.entries[0]).toMatchObject({ quality: "high", citation: "Invented citation" });
    expect(t.note).toMatch(/not a single exact date/);
  });
});

describe("#67 comparison pairs", () => {
  const asset = (id: string, o: Partial<MediaAsset> = {}): MediaAsset => ({
    id, locationId: LOC, derivedFrom: null, transform: [], creator: "Synthetic Photographer", capturedOn: { value: "1990", precision: "year" }, directionDeg: 90, originalSourceRef: "src",
    rights: "cc_by", consent: "not_applicable", containsIdentifiablePeople: false, publicationPermitted: true, withdrawn: false, exifStripped: true, reviewRedaction: "not_needed",
    altText: "Synthetic photo", credit: "Synthetic credit", publicUrl: `https://img.invalid/derivatives/${id}.webp`, ...o,
  });
  // derivative public copies need a private original: build both
  const withOriginal = (id: string, o: Partial<MediaAsset> = {}): MediaAsset[] => [asset(`${id}-orig`, { publicUrl: null, altText: null, credit: null, exifStripped: false, ...o }), asset(id, { derivedFrom: `${id}-orig`, transform: ["resize"], ...o })];
  const assets = [...withOriginal("before"), ...withOriginal("after", { capturedOn: { value: "2026", precision: "year" } })];
  const pair = (o: Partial<Pair> = {}): Pair => ({
    id: "p1", locationId: LOC,
    before: { assetId: "before", locationId: LOC, date: { value: "1990", precision: "year" }, dateVerifiedBy: "rita", uploadedBy: "eve" },
    after: { assetId: "after", locationId: LOC, date: { value: "2026", precision: "year" }, dateVerifiedBy: "sam", uploadedBy: "eve" },
    viewpointNote: "Same corner, camera at the gate", claimsMatchedViewpoint: true, sourceIds: ["s1"], verifiedSourceIds: ["s1"], ...o,
  });
  it("a fully verified pair of the same place is publishable", () => { expect(pairBlockers(pair(), assets)).toEqual([]); });
  it("a missing historical date blocks publication", () => {
    const p = pair({ before: { ...pair().before, date: { value: null, precision: null } } });
    expect(pairBlockers(p, assets)).toContain("before image has no known date");
  });
  it("a mismatched place blocks publication", () => {
    const p = pair({ after: { ...pair().after, locationId: OTHER } });
    expect(pairBlockers(p, assets)).toContain("after image belongs to a different place");
  });
  it("unverified dates, self-verified dates and a single verifier for both are refused", () => {
    expect(pairBlockers(pair({ before: { ...pair().before, dateVerifiedBy: null } }), assets)).toContain("before date is not verified");
    expect(pairBlockers(pair({ before: { ...pair().before, dateVerifiedBy: "eve" } }), assets)).toContain("before date must be verified by someone other than the uploader");
    expect(pairBlockers(pair({ after: { ...pair().after, dateVerifiedBy: "rita" } }), assets)).toContain("before and after dates must be verified independently of each other");
  });
  it("rights or consent problems on either image block the pair, naming the side", () => {
    const bad = [...withOriginal("before", { rights: "unknown" }), ...withOriginal("after", { capturedOn: { value: "2026", precision: "year" } })];
    expect(pairBlockers(pair(), bad).join(" | ")).toMatch(/before image: rights are "unknown"/);
    const withdrawn = [...withOriginal("before"), ...withOriginal("after", { consent: "withdrawn", capturedOn: { value: "2026", precision: "year" } })];
    expect(pairBlockers(pair(), withdrawn).join(" | ")).toMatch(/after image: consent withdrawn/);
  });
  it("order, viewpoint claim and sources are checked", () => {
    expect(pairBlockers(pair({ before: { ...pair().before, date: { value: "2026", precision: "year" } } }), assets)).toContain("the before image is not clearly earlier than the after image");
    expect(pairBlockers(pair({ viewpointNote: "  " }), assets)).toContain("a matched-viewpoint claim needs a viewpoint note");
    expect(pairBlockers(pair({ claimsMatchedViewpoint: false, viewpointNote: "" }), assets)).toEqual([]);
    expect(pairBlockers(pair({ sourceIds: [], verifiedSourceIds: [] }), assets)).toContain("no source");
    expect(pairBlockers(pair({ verifiedSourceIds: [] }), assets)).toContain("no verified source");
  });
});

describe("#64 editorial descriptions", () => {
  const D = (o: Partial<DescriptionDraft> = {}): DescriptionDraft => ({ id: "d", locationId: LOC, revision: 3, text: "A lake used for community gatherings.", sourceIds: ["s1"], observationRefs: [], authorId: "eve", reviewedBy: "rita", reviewedOn: "2026-06-01", ...o });
  const ctx = { latestRevision: 3, today: "2026-11-08", verifiedSourceIds: ["s1"] };
  it("a sourced, current, independently reviewed revision passes", () => { expect(descriptionBlockers(D(), ctx)).toEqual([]); });
  it("a stale revision is rejected", () => { expect(descriptionBlockers(D({ revision: 2 }), ctx)).toContain("stale revision 2; latest is 3"); });
  it("missing, unverified sources and empty text are rejected", () => {
    expect(descriptionBlockers(D({ sourceIds: [] }), ctx)).toContain("no source");
    expect(descriptionBlockers(D({ sourceIds: ["s2"] }), ctx)).toContain("no verified source");
    expect(descriptionBlockers(D({ text: "  " }), ctx)).toContain("description is empty");
  });
  it("an invented site condition (current state without a dated observation) is rejected", () => {
    for (const t of ["The lake is currently clean.", "Today the market is crowded.", "The gate is open.", "It is well-maintained.", "At present the path is unsafe."]) {
      expect(descriptionBlockers(D({ text: t }), ctx), t).toContain("describes current condition without a dated observation");
    }
  });
  it("a condition statement is allowed with a recent dated observation and refused with an old one", () => {
    const text = "The lake is currently clean.";
    expect(descriptionBlockers(D({ text, observationRefs: [{ id: "o1", observedOn: "2026-09-01" }] }), ctx)).toEqual([]);
    expect(descriptionBlockers(D({ text, observationRefs: [{ id: "o1", observedOn: "2024-01-01" }] }), ctx)).toContain("the dated observation is more than a year old; describe it as it was on that date");
  });
  it("review is required, independent and not older than a year", () => {
    expect(descriptionBlockers(D({ reviewedBy: null, reviewedOn: null }), ctx)).toContain("not reviewed");
    expect(descriptionBlockers(D({ reviewedBy: "eve" }), ctx)).toContain("reviewer must differ from author");
    expect(descriptionBlockers(D({ reviewedOn: "2025-01-01" }), ctx).join()).toMatch(/re-review needed/);
    expect(descriptionBlockers(D({ reviewedOn: "2027-01-01" }), ctx)).toContain("review date is in the future");
    expect(descriptionBlockers(D({ reviewedOn: "2025-11-08" }), ctx)).toEqual([]);      // exactly 365 days is still valid
  });
});
