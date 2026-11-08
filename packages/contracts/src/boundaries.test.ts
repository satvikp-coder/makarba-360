import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validatePublic } from "./index.js";

// Synthetic fixtures only (coordinates [10,10], not Makarba). Each case sits exactly on a rule boundary so that
// changing the rule by one (for example k=5 to k=4) makes a test fail. See scripts/mutation_check.py.
const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Cohort = { n: number | null; validAnswerN: number | null; missingN: number | null; unsureN: number | null; ratings: { value: number; count: number }[]; suppressed: boolean };
function cohortWith(n: number, valid = n, missing = 0, unsure = 0) {
  const v = clone(bundle.insights);
  const c = v.cohorts.find((x: Cohort) => !x.suppressed) as Cohort;
  Object.assign(c, { n, validAnswerN: valid, missingN: missing, unsureN: unsure, ratings: valid ? [{ value: 3, count: valid }] : [] });
  return v;
}
const err = (v: unknown) => { const r = validatePublic("insights", v); return r.ok ? null : r.error; };

describe("minimum cohort size boundary (provisional k=5)", () => {
  it("n=4 is rejected, n=5 is accepted, n=6 is accepted", () => {
    expect(err(cohortWith(4))).toMatch(/k5/);
    expect(err(cohortWith(5))).toBeNull();
    expect(err(cohortWith(6))).toBeNull();
  });
  it("n=0 and n=1 are rejected rather than shown as small numbers", () => {
    expect(err(cohortWith(0))).toMatch(/k5/);
    expect(err(cohortWith(1))).toMatch(/k5/);
  });
});

describe("denominator boundary: valid + missing + unsure must not exceed n", () => {
  it("equal to n is accepted; one over is rejected", () => {
    expect(err(cohortWith(10, 7, 2, 1))).toBeNull();
    expect(err(cohortWith(10, 7, 2, 2))).toMatch(/exceed distinct base/);
  });
  it("ratings must add up to the valid-answer count exactly", () => {
    const v = cohortWith(10, 8, 1, 1);
    expect(err(v)).toBeNull();
    (v.cohorts.find((x: Cohort) => !x.suppressed) as Cohort).ratings = [{ value: 3, count: 7 }];
    expect(err(v)).toMatch(/rating denominator mismatch/);
  });
});

describe("missingness: absent data is never zero", () => {
  it("a non-suppressed cohort with null counts is rejected, not read as 0", () => {
    const v = cohortWith(10);
    (v.cohorts.find((x: Cohort) => !x.suppressed) as Cohort).missingN = null;
    expect(err(v)).toMatch(/counts missing/);
  });
  it("a suppressed cohort must carry null counts (0 would be a false value) and a reason", () => {
    const v = clone(bundle.insights);
    const s = v.cohorts.find((x: Cohort) => x.suppressed);
    s.n = 0;
    expect(err(v)).toMatch(/suppressed cohort leaks counts/);
    s.n = null; delete s.reasonCode;
    expect(err(v)).toMatch(/suppression reason missing/);
  });
  it("a suppressed cohort cannot carry ratings that would allow reconstruction", () => {
    const v = clone(bundle.insights);
    v.cohorts.find((x: Cohort) => x.suppressed).ratings = [{ value: 1, count: 1 }];
    expect(err(v)).toMatch(/suppressed cohort leaks detail/);
  });
});

describe("public field denylist is case/punctuation insensitive", () => {
  it.each(["interviewLatitude", "interview_latitude", "INTERVIEWLATITUDE", "Interview-Latitude"])("rejects %s", (key) => {
    const v = clone(bundle.locations);
    v.features[0].properties[key] = 10;
    const r = validatePublic("locations", v);
    expect(r.ok).toBe(false);
  });
});
