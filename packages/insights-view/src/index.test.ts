import { describe, expect, it } from "vitest";
import { captionFor, viewCell, viewCohort, viewInsights } from "./index.js";

const ready = { cohortId: "synthetic-a", suppressed: false, n: 12, validAnswerN: 10, missingN: 1, unsureN: 1, respondentCategories: [], ratings: [{ value: 4, count: 10 }], issues: [], denominatorLabel: "Respondents", countingRule: "distinct respondents" };
const supp = { cohortId: "synthetic-b", suppressed: true, n: null, validAnswerN: null, missingN: null, unsureN: null, respondentCategories: [], ratings: [], issues: [], reasonCode: "k_threshold" };
const period = { fromMonth: "2026-01", throughMonth: "2026-03" };

describe("insights view model (synthetic fixtures)", () => {
  it("ready cohort shows n, missingness, period and sample caveat in the caption", () => {
    const v = viewCohort(ready);
    expect(v.kind).toBe("ready");
    const t = captionFor(v, period, "Convenience sample; not representative.").text;
    for (const s of ["n = 12", "missing 1", "unsure 1", "2026-01", "2026-03", "not representative"]) expect(t).toContain(s);
  });
  it("suppressed cohort is explained and never rendered as zero", () => {
    const v = viewCohort(supp);
    expect(v.kind).toBe("suppressed");
    expect(viewCell(v, 0)).toEqual({ kind: "none", text: "Suppressed" });
    expect(captionFor(v, period, "x").text).toMatch(/not zero/i);
  });
  it("no-data, null and bad counts are not zero; explicit zero is zero", () => {
    const v = viewCohort(ready);
    for (const bad of [null, undefined, NaN, -1, 1.5]) expect(viewCell(v, bad as number)).toEqual({ kind: "none", text: "No data" });
    expect(viewCell(v, 0)).toEqual({ kind: "value", text: "0", count: 0 });
  });
  it("a cohort that leaks counts while suppressed is invalid and not shown", () => {
    const v = viewCohort({ ...supp, n: 3 });
    expect(v.kind).toBe("invalid");
    expect(viewCell(v, 3).text).toBe("Unavailable");
  });
  it("a cohort below k5 or with inconsistent denominators is invalid", () => {
    expect(viewCohort({ ...ready, n: 3, validAnswerN: 2, missingN: 1, unsureN: 0, ratings: [{ value: 4, count: 2 }] }).kind).toBe("invalid");
    expect(viewCohort({ ...ready, ratings: [{ value: 4, count: 9 }] }).kind).toBe("invalid");
  });
  it("caption cannot be built without period or sample note", () => {
    expect(() => captionFor(viewCohort(ready), { fromMonth: "", throughMonth: "x" }, "n")).toThrow();
    expect(() => captionFor(viewCohort(ready), period, " ")).toThrow();
  });
  it("viewInsights keeps invalid cohorts visible as invalid and rejects malformed payloads", () => {
    const ok = viewInsights({ cohorts: [ready, supp, { junk: 1 }], collectionPeriod: period, sampleNote: "n" });
    expect(ok.ok && ok.cohorts.map((c) => c.kind)).toEqual(["ready", "suppressed", "invalid"]);
    expect(viewInsights(null).ok).toBe(false);
    expect(viewInsights({ cohorts: "x" }).ok).toBe(false);
  });
});
