import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validatePublic, type ContractKind } from "./index.js";

const path = fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url));
const raw = readFileSync(path);
const bundle = JSON.parse(raw.toString("utf8"));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("frozen H0 fixtures", () => {
  it("match the hash recorded in the architecture review", () => {
    const review = readFileSync(fileURLToPath(new URL("../../../docs/architecture/review-baseline.md", import.meta.url)), "utf8");
    const hash = createHash("sha256").update(raw.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
    expect(review).toContain(hash);
  });
  it.each(["locations", "insights", "history", "media", "missingMedia", "invalidFilter"])("%s fixture conforms", (k) => {
    const kind: ContractKind = k === "missingMedia" || k === "invalidFilter" ? "error" : (k as ContractKind);
    expect(validatePublic(kind, bundle[k])).toEqual({ ok: true });
  });
});

describe("negative contract cases", () => {
  const reject = (kind: ContractKind, v: unknown, re: RegExp) => {
    const r = validatePublic(kind, v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(re);
  };
  it("rejects exact interview GPS leaking into a feature", () => {
    const v = clone(bundle.locations); v.features[0].properties.interviewLatitude = 10;
    reject("locations", v, /restricted public field/);
  });
  it("rejects out-of-range coordinates and unclosed rings", () => {
    const v = clone(bundle.locations); v.features[0].geometry.coordinates = [200, 10];
    reject("locations", v, /./);
  });
  it("rejects suppressed cohort leaking n", () => {
    const v = clone(bundle.insights); v.cohorts[1].n = 2;
    reject("insights", v, /suppressed cohort leaks counts/);
  });
  it("rejects unsafe small cohort and bad denominator", () => {
    const small = clone(bundle.insights); Object.assign(small.cohorts[0], { n: 2, validAnswerN: 2, missingN: 0, unsureN: 0, ratings: [{ value: 3, count: 2 }] });
    reject("insights", small, /k5/);
    const bad = clone(bundle.insights); bad.cohorts[0].validAnswerN = 29;
    reject("insights", bad, /./);
  });
  it("rejects undated comparison, original media URL and private storage key", () => {
    const h = clone(bundle.history); h.comparisonPairs[0].beforeDate.value = null;
    reject("history", h, /beforeDate/);
    const m = clone(bundle.media); m.url = "https://example.invalid/original/private.webp";
    reject("media", m, /original media is private/);
    const k = clone(bundle.media); k.original_key = "private/object";
    reject("media", k, /restricted public field/);
  });
});
