import { describe, expect, it } from "vitest";
import { resolveCohort, validateManifest, type ApprovedCohort } from "./cohorts.js";
import type { Interview, Topic } from "./index.js";

const topic = (subjectId: string): Topic => ({ subjectId, rating: 3, ratingReason: "answered", change: null, issuesSelected: null, issuesCoded: [] });
let n = 0;
const iv = (o: Partial<Interview> = {}): Interview => ({ id: `i${++n}`, status: "approved", currentRevision: true, consentResearch: true, consentAggregate: true, withdrawn: false, month: "2026-02", questionVersion: "v1", stakeholder: "resident", association: "1to5", interviewLocationId: "street-A", topics: [topic("lake-B")], ...o });
const many = (k: number, o: Partial<Interview> = {}) => Array.from({ length: k }, () => iv(o));
const P = { from: "2026-01", through: "2026-03" };
const c = (id: string, stakeholder: string | null, placeId: string | null): ApprovedCohort => ({ id, label: id, period: P, stakeholder, placeId });
const manifest = [c("all", null, null), c("residents", "resident", null), c("lake", null, "lake-B")];
const key = "2026-01..2026-03";

describe("resolveCohort: only reviewed combinations", () => {
  it("resolves an approved combination and derives the cache key from the approved id only", () => {
    expect(resolveCohort(manifest, { period: key }, "snap1")).toMatchObject({ ok: true, cacheKey: "cohort:snap1:all" });
    expect(resolveCohort(manifest, { period: key, stakeholder: "resident" }, "snap1")).toMatchObject({ ok: true, cohort: { id: "residents" } });
    expect(resolveCohort(manifest, { period: key, place: "lake-B" }, "snap1")).toMatchObject({ ok: true, cohort: { id: "lake" } });
  });
  it("an unsupported intersection cannot be requested, even if each part is approved on its own", () => {
    const r = resolveCohort(manifest, { period: key, stakeholder: "resident", place: "lake-B" }, "s");
    expect(r).toEqual({ ok: false, reason: "that combination is not an approved cohort" });
  });
  it("unknown values, other periods and missing periods are refused", () => {
    for (const req of [{ period: key, stakeholder: "official" }, { period: "2026-01..2026-12" }, { period: "2026-01..2026-03", place: "' OR 1=1 --" }, {}, { stakeholder: "resident" }]) {
      expect(resolveCohort(manifest, req, "s").ok).toBe(false);
    }
  });
  it("empty strings and null are not wildcards that can select several cohorts", () => {
    expect(resolveCohort(manifest, { period: key, stakeholder: "" }, "s").ok).toBe(false);
    expect(resolveCohort(manifest, { period: key, stakeholder: null, place: null }, "s")).toMatchObject({ ok: true, cohort: { id: "all" } });
  });
  it("an ambiguous manifest never resolves (two entries for one combination)", () => {
    expect(resolveCohort([...manifest, c("all-dup", null, null)], { period: key }, "s").ok).toBe(false);
  });
});

describe("validateManifest: no reconstruction by differencing", () => {
  it("a safe manifest reports no problems", () => {
    expect(validateManifest(manifest, [...many(12), ...many(8, { stakeholder: "worker", topics: [topic("road-C")] })])).toEqual([]);
  });
  it("a cohort smaller than k is reported", () => {
    const p = validateManifest(manifest, [...many(4)]);
    expect(p.map((x) => x.cohortId).sort()).toEqual(["all", "lake", "residents"]);
    expect(p[0]!.problem).toMatch(/below the minimum of 5/);
  });
  it("a cohort that differs from a bigger one by fewer than k people is reported (the difference would be revealed)", () => {
    // 10 residents; 7 of them discussed lake-B, 3 did not. Residents (10) minus residents-at-lake (7) = 3 people.
    const data = [...many(7), ...many(3, { topics: [topic("road-C")] })];
    const m = [c("residents", "resident", null), c("residents-lake", "resident", "lake-B")];
    const p = validateManifest(m, data);
    expect(p).toEqual([{ cohortId: "residents-lake", problem: 'differs from "residents" by only 3 interviews; the difference would be revealed' }]);
  });
  it("the same pair is fine once the difference reaches k", () => {
    const data = [...many(7), ...many(5, { topics: [topic("road-C")] })];
    expect(validateManifest([c("residents", "resident", null), c("residents-lake", "resident", "lake-B")], data)).toEqual([]);
  });
  it("duplicate ids or duplicate combinations are reported; ineligible interviews do not count toward size", () => {
    expect(validateManifest([c("a", null, null), c("a", "resident", null)], many(10)).some((x) => x.problem === "duplicate id")).toBe(true);
    expect(validateManifest([c("a", null, null), c("b", null, null)], many(10)).some((x) => x.problem === "same combination listed twice")).toBe(true);
    const p = validateManifest([c("a", null, null)], [...many(4), ...many(10, { withdrawn: true })]);
    expect(p[0]!.problem).toMatch(/only 4 interviews/);
  });
});
