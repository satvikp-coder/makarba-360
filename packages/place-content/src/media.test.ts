import { describe, expect, it } from "vitest";
import { checkPublicCopy, lineage, MediaAsset, toPublicMedia, withdraw } from "./media.js";

const LOC = "00000000-0000-4000-8000-000000000001"; // synthetic
const original = (o: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "orig", locationId: LOC, derivedFrom: null, transform: [], creator: "Synthetic Photographer", capturedOn: { value: "2021-05", precision: "month" },
  directionDeg: 90, originalSourceRef: "synthetic-source-1", rights: "cc_by", consent: "not_applicable", containsIdentifiablePeople: false,
  publicationPermitted: true, withdrawn: false, exifStripped: false, reviewRedaction: "not_needed", altText: null, credit: null, publicUrl: null, ...o,
});
const derivative = (o: Partial<MediaAsset> = {}): MediaAsset => ({
  ...original(), id: "pub", derivedFrom: "orig", transform: ["resize", "strip_exif"], exifStripped: true, altText: "A synthetic street scene",
  credit: "Synthetic Photographer, CC BY", publicUrl: "https://example.invalid/derivatives/pub.webp", ...o,
});
const why = (id: string, all: MediaAsset[]) => { const r = checkPublicCopy(id, all); return r.ok ? [] : r.reasons; };

describe("positive: a fully traced, cleared derivative is publishable", () => {
  it("passes and the public view carries only public fields", () => {
    const all = [original(), derivative()];
    expect(why("pub", all)).toEqual([]);
    const p = toPublicMedia("pub", all)!;
    expect(p).toMatchObject({ licence: "cc_by", credit: "Synthetic Photographer, CC BY", capturedDate: { value: "2021-05", precision: "month" } });
    expect(JSON.stringify(p)).not.toMatch(/synthetic-source-1|directionDeg|consent|creator|orig\b/);
  });
  it("lineage reaches the original through several derivatives", () => {
    const all = [original(), derivative({ id: "mid", publicUrl: null }), derivative({ id: "pub", derivedFrom: "mid" })];
    expect(lineage("pub", all).chain.map((a) => a.id)).toEqual(["pub", "mid", "orig"]);
    expect(why("pub", all)).toEqual([]);
  });
});

describe("negative: unknown rights or withdrawn consent blocks the public copy", () => {
  it.each(["unknown", "all_rights_reserved"] as const)("rights %s blocks publication", (rights) => {
    expect(why("pub", [original({ rights }), derivative()])).toContain(`rights are "${rights}"; cannot publish`);
  });
  it("consent withdrawn on the original blocks the derivative", () => {
    expect(why("pub", [original({ consent: "withdrawn" }), derivative()])).toContain("consent withdrawn on orig");
  });
  it("research-only or never-requested consent blocks publication", () => {
    expect(why("pub", [original({ consent: "research_only" }), derivative()])).toContain('consent is "research_only"; cannot publish');
    expect(why("pub", [original({ consent: "not_requested" }), derivative()])).toContain('consent is "not_requested"; cannot publish');
  });
  it("identifiable people need granted consent and a completed redaction review", () => {
    const o = original({ containsIdentifiablePeople: true, consent: "granted" });
    expect(why("pub", [o, derivative({ reviewRedaction: "pending" })])).toContain("face/plate redaction review not done");
    expect(why("pub", [o, derivative({ reviewRedaction: "done" })])).toEqual([]);
    expect(why("pub", [original({ containsIdentifiablePeople: true, consent: "not_applicable" }), derivative({ reviewRedaction: "done" })])).toContain('identifiable people with consent "not_applicable"');
  });
  it("an intermediate withdrawn link blocks even when the original is fine", () => {
    const all = [original(), derivative({ id: "mid", withdrawn: true, publicUrl: null }), derivative({ id: "pub", derivedFrom: "mid" })];
    expect(why("pub", all)).toContain("mid is withdrawn");
  });
});

describe("other publication blockers", () => {
  it("originals are never published", () => { expect(why("orig", [original()])).toContain("an original is never published; publish a reviewed derivative"); });
  it("missing creator, date, EXIF stripping, alt text, credit all block", () => {
    const r = why("pub", [original({ creator: null, capturedOn: { value: null, precision: null } }), derivative({ capturedOn: { value: null, precision: null }, exifStripped: false, altText: null, credit: null })]);
    expect(r).toEqual(expect.arrayContaining(["creator unknown", "capture date unknown", "EXIF metadata not stripped on the public copy", "alt text missing", "credit missing"]));
  });
  it("a public URL pointing at original storage or plain http is refused", () => {
    expect(why("pub", [original(), derivative({ publicUrl: "https://example.invalid/original/pub.jpg" })])).toContain("public URL missing or points at original storage");
    expect(why("pub", [original(), derivative({ publicUrl: "http://example.invalid/pub.jpg" })])).toContain("public URL missing or points at original storage");
  });
  it("a dangling parent or a cycle is an error, not a pass", () => {
    expect(why("pub", [derivative()])).toEqual(["parent orig of pub not found"]);
    expect(why("a", [original({ id: "a", derivedFrom: "b" }), original({ id: "b", derivedFrom: "a" })])).toEqual(["derivative cycle"]);
    expect(why("ghost", [])).toEqual(["asset ghost not found"]);
  });
  it("a bearing outside 0..360 or a date value without precision is invalid", () => {
    expect(MediaAsset.safeParse(original({ directionDeg: 360 })).success).toBe(false);
    expect(MediaAsset.safeParse(original({ capturedOn: { value: "2021", precision: null } })).success).toBe(false);
  });
});

describe("withdrawal cascades to every derivative", () => {
  it("withdrawing the original removes all copies from public view and does not mutate input", () => {
    const all = [original(), derivative({ id: "mid", publicUrl: null }), derivative({ id: "pub", derivedFrom: "mid" })];
    expect(toPublicMedia("pub", all)).not.toBeNull();
    const after = withdraw("orig", all);
    expect(after.every((a) => a.withdrawn && !a.publicationPermitted && a.publicUrl === null)).toBe(true);
    expect(toPublicMedia("pub", after)).toBeNull();
    expect(all.some((a) => a.withdrawn)).toBe(false);
  });
  it("withdrawing one derivative leaves siblings and the original alone", () => {
    const all = [original(), derivative({ id: "a" }), derivative({ id: "b" })];
    const after = withdraw("a", all);
    expect(after.find((x) => x.id === "b")!.withdrawn).toBe(false);
    expect(after.find((x) => x.id === "orig")!.withdrawn).toBe(false);
    expect(toPublicMedia("b", after)).not.toBeNull();
  });
});
