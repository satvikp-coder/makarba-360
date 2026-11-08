import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validatePublic } from "@makarba/contracts";
import { describe, expect, it } from "vitest";
import { eligibility, issuesAnalysis, locationSummary, ratingGroupToCohort, ratingsAnalysis, stakeholderDistribution, suppress, type Interview, type Topic } from "./index.js";

// All records are synthetic. Expected values below are written by hand from the fixtures, not computed by the code under test.
const P = { from: "2026-01", through: "2026-03" };
let seq = 0;
const topic = (subjectId: string, o: Partial<Topic> = {}): Topic => ({ subjectId, rating: 3, ratingReason: "answered", change: null, issuesSelected: null, issuesCoded: [], ...o });
const iv = (o: Partial<Interview> = {}): Interview => ({
  id: `i${++seq}`, status: "approved", currentRevision: true, consentResearch: true, consentAggregate: true, withdrawn: false, month: "2026-02", questionVersion: "v1",
  stakeholder: "resident", association: "1to5", interviewLocationId: "street-A", topics: [topic("lake-B")], ...o,
});
const many = (n: number, o: Partial<Interview> | ((i: number) => Partial<Interview>) = {}) => Array.from({ length: n }, (_, i) => iv(typeof o === "function" ? o(i) : o));

describe("eligibility", () => {
  it("excludes each ineligible record for its own reason and reports collected vs analysed", () => {
    const dup = iv();
    const all = [
      ...many(20),
      iv({ status: "rejected" }), iv({ status: "draft" }), iv({ status: "duplicate" }), iv({ currentRevision: false }),
      iv({ consentResearch: false }), iv({ consentAggregate: false }), iv({ withdrawn: true }), iv({ month: "2025-12" }), iv({ month: "2026-04" }),
      dup, { ...dup },
    ];
    const e = eligibility(all, P);
    expect(e.eligible).toHaveLength(21);          // 20 + the single `dup` record
    expect(e.collected).toBe(30);                 // 20 + 9 ineligible + dup counted once
    expect(e.excluded).toEqual({ not_approved: 3, superseded_revision: 1, no_research_consent: 1, no_aggregate_consent: 1, withdrawn: 1, outside_period: 2, duplicate_record: 1 });
  });
  it("withdrawal wins over approval; period bounds are inclusive", () => {
    expect(eligibility([iv({ withdrawn: true })], P).eligible).toHaveLength(0);
    expect(eligibility([iv({ month: "2026-01" }), iv({ month: "2026-03" })], P).eligible).toHaveLength(2);
  });
});

describe("suppress (disclosure)", () => {
  it("hides cells under k and never reports them as zero", () => {
    const r = suppress([{ code: "a", count: 10 }, { code: "b", count: 9 }, { code: "c", count: 4 }, { code: "d", count: 0 }]);
    expect(r.shown.map((s) => s.code)).toEqual(["a"]);   // c hidden (under k), b hidden to protect it, d never appears
    expect(JSON.stringify(r)).not.toContain('"count":0');
  });
  it("one hidden cell also hides the smallest remaining one (complementary), two hidden need no extra", () => {
    const one = suppress([{ code: "a", count: 10 }, { code: "b", count: 8 }, { code: "c", count: 2 }]);
    expect(one).toMatchObject({ shown: [{ code: "a", count: 10 }], suppressedCount: 2, complementary: true });
    const two = suppress([{ code: "a", count: 10 }, { code: "b", count: 2 }, { code: "c", count: 3 }]);
    expect(two).toMatchObject({ shown: [{ code: "a", count: 10 }], suppressedCount: 2, complementary: false });
  });
  it("exactly k is shown, k-1 is not", () => {
    expect(suppress([{ code: "a", count: 5 }, { code: "b", count: 5 }]).shown).toHaveLength(2);
    expect(suppress([{ code: "a", count: 5 }, { code: "b", count: 4 }]).shown).toHaveLength(0);
  });
});

describe("#85 stakeholder distribution", () => {
  it("counts distinct interviews per category; a multi-place interview counts once", () => {
    const multi = (n: number, s: string) => many(n, { stakeholder: s, topics: [topic("lake-B"), topic("road-C"), topic("market-D")] });
    const r = stakeholderDistribution([...multi(12, "resident"), ...multi(8, "worker")], P);
    expect(r.analysed).toBe(20);
    expect(r.categories.shown).toEqual([{ code: "resident", count: 12 }, { code: "worker", count: 8 }]);
    expect(r.categories.shown.reduce((a, c) => a + c.count, 0)).toBe(20);   // not 60
  });
  it("small categories are hidden with complementary suppression so they cannot be recovered by subtraction", () => {
    const r = stakeholderDistribution([...many(10, { stakeholder: "resident" }), ...many(8, { stakeholder: "worker" }), ...many(2, { stakeholder: "official" })], P);
    expect(r.categories.shown).toEqual([{ code: "resident", count: 10 }]);
    expect(r.categories.complementary).toBe(true);
  });
  it("unknown/refused is reported separately and hidden (null, not 0) when small", () => {
    const small = stakeholderDistribution([...many(19, { stakeholder: "resident" }), ...many(2, { stakeholder: null })], P);
    expect(small.unknownOrRefused).toBeNull();
    const big = stakeholderDistribution([...many(12, { stakeholder: "resident" }), ...many(6, { stakeholder: null })], P);
    expect(big.unknownOrRefused).toBe(6);
  });
  it("below k nothing is released and no counts leak", () => {
    const r = stakeholderDistribution(many(4), P);
    expect(r).toMatchObject({ released: false, reason: "BELOW_K", analysed: 4 });
    expect(r.categories.shown).toEqual([]);
  });
  it("ineligible interviews never contribute", () => {
    const r = stakeholderDistribution([...many(6, { stakeholder: "resident" }), ...many(10, { stakeholder: "worker", withdrawn: true })], P);
    expect(r.analysed).toBe(6);
    expect(r.excluded).toEqual({ withdrawn: 10 });
  });
});

describe("#86 reported issues", () => {
  const withIssues = (n: number, sel: string[] | null, coded: string[] = []) =>
    many(n, { topics: [topic("lake-B", { issuesSelected: sel, issuesCoded: coded.map((theme) => ({ theme, coder: "coder-1", codebookVersion: "cb-1" })) })] });
  it("keeps selected categories and analyst-coded themes separate", () => {
    const r = issuesAnalysis([...withIssues(10, ["walking"], ["pedestrian_safety"]), ...withIssues(6, ["walking"])], P);
    expect(r.selected.shown).toEqual([{ code: "walking", count: 16 }]);
    expect(r.coded.shown).toEqual([{ code: "pedestrian_safety", count: 10 }]);
    expect(r.codebookVersions).toEqual(["cb-1"]);
    expect(r.coders).toBe(1);
  });
  it("percentages use responding interviews as the base and can exceed 100% in total, with the note", () => {
    const r = issuesAnalysis(withIssues(10, ["walking", "lighting", "noise"]), P);
    expect(r.percentOfResponding.selected).toEqual({ lighting: 100, noise: 100, walking: 100 });
    expect(Object.values(r.percentOfResponding.selected).reduce((a, b) => a + b, 0)).toBe(300);
    expect(r.multiResponseNote).toMatch(/more than 100%/);
  });
  it("an interview that names the same issue for several places counts once", () => {
    const rows = many(10, { topics: [topic("lake-B", { issuesSelected: ["walking"] }), topic("road-C", { issuesSelected: ["walking"] })] });
    expect(issuesAnalysis(rows, P).selected.shown).toEqual([{ code: "walking", count: 10 }]);
  });
  it("blank is not 'no concerns': unanswered interviews are outside the base; answered-none is inside it", () => {
    const r = issuesAnalysis([...withIssues(8, ["walking"]), ...withIssues(5, null), ...withIssues(2, [])], P);
    expect(r.respondingInterviews).toBe(10);
    expect(r.notAnswered).toBe(5);
    expect(r.percentOfResponding.selected["walking"]).toBe(80);
  });
  it("small categories are suppressed and below-k bases release nothing", () => {
    const r = issuesAnalysis([...withIssues(20, ["walking"]), ...withIssues(2, ["flooding"])], P);
    expect(r.selected.shown.map((s) => s.code)).not.toContain("flooding");
    expect(issuesAnalysis(withIssues(4, ["walking"]), P)).toMatchObject({ released: false, reason: "BELOW_K", selected: { shown: [] } });
  });
});

describe("#87 ratings and perceived change", () => {
  const rate = (n: number, rating: number | null, reason: Topic["ratingReason"] = "answered", o: Partial<Interview> = {}, subject = "lake-B") =>
    many(n, { topics: [topic(subject, { rating, ratingReason: reason })], ...o });
  it("shows valid n, unsure, refused and not-asked separately, and an unsure answer is not a zero", () => {
    const r = ratingsAnalysis([...rate(6, 4), ...rate(5, 2), ...rate(3, null, "unsure"), ...rate(2, null, "refused"), ...rate(1, null, "not_asked")], "lake-B", P);
    const g = r.groups[0]!;
    expect(g).toMatchObject({ respondents: 17, validN: 11, unsureN: 3, refusedN: 2, notAskedN: 1, released: true });
    expect(g.distribution.shown).toEqual([{ code: "2", count: 5 }, { code: "4", count: 6 }]);
    expect(g.distribution.shown.some((s) => s.code === "0")).toBe(false);
  });
  it("out-of-scale or fractional ratings are counted as invalid, not as valid answers", () => {
    const g = ratingsAnalysis([...rate(5, 3), ...rate(1, 0), ...rate(1, 6), ...rate(1, 2.5)], "lake-B", P).groups[0]!;
    expect(g).toMatchObject({ validN: 5, invalidN: 3 });
  });
  it("an interview held at A about B rates B and never A", () => {
    const rows = rate(8, 5, "answered", { interviewLocationId: "street-A" });
    expect(ratingsAnalysis(rows, "lake-B", P).groups[0]!.validN).toBe(8);
    expect(ratingsAnalysis(rows, "street-A", P).groups).toEqual([]);
  });
  it("incompatible questionnaire versions are not pooled; a reviewed mapping pools them and says so", () => {
    const rows = [...rate(6, 4, "answered", { questionVersion: "v1" }), ...rate(6, 2, "answered", { questionVersion: "v2" })];
    const sep = ratingsAnalysis(rows, "lake-B", P);
    expect(sep.groups.map((g) => [g.versions, g.validN])).toEqual([[["v1"], 6], [["v2"], 6]]);
    expect(sep.groups.every((g) => !g.pooledByReviewedMapping)).toBe(true);
    const pooled = ratingsAnalysis(rows, "lake-B", P, { mapping: { v1: "overall-rating", v2: "overall-rating" } });
    expect(pooled.groups).toHaveLength(1);
    expect(pooled.groups[0]).toMatchObject({ versions: ["v1", "v2"], validN: 12, pooledByReviewedMapping: true });
  });
  it("a group below k releases nothing, and the numbers are null/empty rather than zero", () => {
    const g = ratingsAnalysis(rate(4, 5), "lake-B", P).groups[0]!;
    expect(g).toMatchObject({ released: false, reason: "BELOW_K", changeDontKnow: null });
    expect(g.distribution.shown).toEqual([]);
  });
  it("perceived change keeps 'don't know' separate and carries a no-cause note; association context is shown with suppression", () => {
    const rows = [
      ...many(7, { association: "over5", topics: [topic("lake-B", { change: "better" })] }),
      ...many(6, { association: "1to5", topics: [topic("lake-B", { change: "worse" })] }),
      ...many(5, { association: "under1", topics: [topic("lake-B", { change: "dont_know" })] }),
      ...many(5, { association: null, topics: [topic("lake-B", { change: "same" })] }),
    ];
    const r = ratingsAnalysis(rows, "lake-B", P);
    const g = r.groups[0]!;
    expect(g.changeDontKnow).toBe(5);
    expect(g.change.shown.map((c) => c.code)).toEqual(["better", "same", "worse"]);
    expect(g.change.shown.some((c) => c.code === "dont_know")).toBe(false);
    expect(g.byAssociation.shown.map((c) => c.code).sort()).toEqual(["1to5", "over5", "under1"]);
    expect(r.note).toMatch(/not measured change.*nothing about cause/);
  });
  it("projection to the public contract is valid and omits hidden cells; unsafe groups become suppressed cohorts", () => {
    const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));
    const rows = [...rate(6, 4), ...rate(5, 2), ...rate(3, null, "unsure"), ...rate(1, null, "refused")];
    const ok = ratingGroupToCohort("lake-B", ratingsAnalysis(rows, "lake-B", P).groups[0]!);
    expect(ok).toMatchObject({ suppressed: false, n: 15, validAnswerN: 11, unsureN: 3, missingN: 1 });
    expect(validatePublic("insights", { ...bundle.insights, cohorts: [ok] })).toEqual({ ok: true });
    // a hidden rating cell would make the ratings not add up to the valid base: the cohort must be suppressed
    const risky = ratingGroupToCohort("lake-B", ratingsAnalysis([...rate(9, 4), ...rate(2, 1)], "lake-B", P).groups[0]!);
    expect(risky).toMatchObject({ suppressed: true, n: null, ratings: [] });
    expect(validatePublic("insights", { ...bundle.insights, cohorts: [risky] })).toEqual({ ok: true });
    const small = ratingGroupToCohort("lake-B", ratingsAnalysis(rate(3, 4), "lake-B", P).groups[0]!);
    expect(small.suppressed).toBe(true);
  });
});

describe("#89 location summaries", () => {
  it("counts the interviews that DISCUSSED the place, wherever they were held", () => {
    const heldAtB = many(3, { interviewLocationId: "lake-B", topics: [topic("street-A")] });      // held at B, about A
    const heldAtAAboutB = many(7, { interviewLocationId: "street-A", topics: [topic("lake-B")] }); // held at A, about B
    const all = [...heldAtB, ...heldAtAAboutB];
    expect(locationSummary(all, "lake-B", P)).toMatchObject({ released: true, interviews: 7 });
    expect(locationSummary(all, "street-A", P)).toMatchObject({ released: false, reason: "BELOW_K", interviews: null });   // only 3 are about A
  });
  it("issues come from topic blocks about this place only", () => {
    const all = [
      ...many(6, { topics: [topic("lake-B", { issuesSelected: ["litter"] }), topic("road-C", { issuesSelected: ["traffic"] })] }),
      ...many(6, { topics: [topic("road-C", { issuesSelected: ["traffic"] })] }),
    ];
    const s = locationSummary(all, "lake-B", P);
    expect(s.interviews).toBe(6);
    expect(s.topIssues.shown).toEqual([{ code: "litter", count: 6 }]);
  });
  it("explains overlap and reports it only when neither it nor the remainder can reveal a small group", () => {
    const multi = many(6, { topics: [topic("lake-B"), topic("road-C")] });
    const single = many(6, { topics: [topic("lake-B")] });
    const ok = locationSummary([...multi, ...single], "lake-B", P);
    expect(ok).toMatchObject({ interviews: 12, alsoDiscussedOtherPlaces: 6 });
    expect(ok.overlapNote).toMatch(/overlap and must not be added together/);
    const risky = locationSummary([...many(2, { topics: [topic("lake-B"), topic("road-C")] }), ...many(10, { topics: [topic("lake-B")] })], "lake-B", P);
    expect(risky.interviews).toBe(12);
    expect(risky.alsoDiscussedOtherPlaces).toBeNull();
  });
  it("withdrawn, unapproved and out-of-period interviews do not count toward the place", () => {
    const s = locationSummary([...many(5), ...many(3, { withdrawn: true }), ...many(3, { status: "draft" }), ...many(3, { month: "2025-05" })], "lake-B", P);
    expect(s.interviews).toBe(5);
  });
  it("an unknown place has no summary rather than a zero", () => {
    expect(locationSummary(many(10), "nowhere", P)).toMatchObject({ released: false, interviews: null });
  });
});
