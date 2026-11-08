import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { eligibility, issuesAnalysis, locationSummary, ratingsAnalysis, stakeholderDistribution, type Interview, type Period } from "./index.js";

// Frozen synthetic cases (#93). The expected values live in the JSON file and were computed by hand from its rows (see
// "methodNotes" there). This test only compares the code's output with them; it must never be used to regenerate them.
const file = fileURLToPath(new URL("../../../docs/project/fixtures/analytics-cases.json", import.meta.url));
const doc = JSON.parse(readFileSync(file, "utf8")) as { period: Period; records: Interview[]; methodNotes: string[]; expected: Expected };
interface Expected {
  eligibility: unknown; stakeholders: unknown;
  ratingsLakeB: { respondents: number; validN: number; unsureN: number; refusedN: number; notAskedN: number; invalidN: number; shown: unknown; suppressedCount: number; complementary: boolean };
  issues: { respondingInterviews: number; notAnswered: number; selectedShown: unknown; codedShown: unknown; percentSelected: unknown; percentCoded: unknown; coders: number; codebookVersions: unknown };
  locations: { lakeB: unknown; roadC: unknown };
}
const { period, records, expected: X } = doc;

describe("frozen analytics cases", () => {
  it("fixture is intact: 34 rows, every note present, nothing resembles real data", () => {
    expect(records).toHaveLength(34);
    expect(doc.methodNotes).toHaveLength(8);
    expect(new Set(records.map((r) => r.id)).size).toBe(33);             // one duplicate row on purpose
    expect(JSON.stringify(doc)).not.toMatch(/makarba|@|\+91|\b\d{10}\b/i);
  });
  it("eligibility: every exclusion reason and the collected/analysed split", () => {
    const e = eligibility(records, period);
    expect({ collected: e.collected, analysed: e.eligible.length, excluded: e.excluded }).toEqual(X.eligibility);
  });
  it("multi-place interviews count once in the overall distribution (26 analysed, not 26 + extra topic blocks)", () => {
    const r = stakeholderDistribution(records, period);
    expect(r.analysed).toBe(26);
    expect(records.filter((i) => i.topics.length > 1).length).toBeGreaterThan(0);
  });
  it("stakeholder distribution incl. complementary suppression and hidden unknown", () => {
    const r = stakeholderDistribution(records, period);
    expect({ released: r.released, shown: r.categories.shown, suppressedCount: r.categories.suppressedCount, complementary: r.categories.complementary, unknownOrRefused: r.unknownOrRefused }).toEqual(X.stakeholders);
  });
  it("ratings for lake-B: valid n, unsure, refused, not asked and suppression", () => {
    const g = ratingsAnalysis(records, "lake-B", period).groups;
    expect(g).toHaveLength(1);
    const x = X.ratingsLakeB;
    expect({ respondents: g[0]!.respondents, validN: g[0]!.validN, unsureN: g[0]!.unsureN, refusedN: g[0]!.refusedN, notAskedN: g[0]!.notAskedN, invalidN: g[0]!.invalidN }).toEqual({ respondents: x.respondents, validN: x.validN, unsureN: x.unsureN, refusedN: x.refusedN, notAskedN: x.notAskedN, invalidN: x.invalidN });
    expect(g[0]!.distribution.shown).toEqual(x.shown);
    expect(g[0]!.distribution.suppressedCount).toBe(x.suppressedCount);
    expect(g[0]!.distribution.complementary).toBe(x.complementary);
  });
  it("ratings for the street where interviews were held: none (held at street-A, nobody discussed it)", () => {
    expect(ratingsAnalysis(records, "street-A", period).groups).toEqual([]);
  });
  it("issues: selected vs coded, bases, percentages, hidden cells", () => {
    const r = issuesAnalysis(records, period);
    const x = X.issues;
    expect(r.respondingInterviews).toBe(x.respondingInterviews);
    expect(r.notAnswered).toBe(x.notAnswered);
    expect(r.selected.shown).toEqual(x.selectedShown);
    expect(r.coded.shown).toEqual(x.codedShown);
    expect(r.percentOfResponding.selected).toEqual(x.percentSelected);
    expect(r.percentOfResponding.coded).toEqual(x.percentCoded);
    expect(r.coders).toBe(x.coders);
    expect(r.codebookVersions).toEqual(x.codebookVersions);
    expect(r.selected.shown.map((s) => s.code)).not.toContain("noise");        // 3 < 5
    expect(r.selected.shown.map((s) => s.code)).not.toContain("lighting");     // hidden to protect noise
  });
  it("location summaries: interviews about the place, overlap explained", () => {
    const lake = locationSummary(records, "lake-B", period), road = locationSummary(records, "road-C", period);
    expect({ interviews: lake.interviews, alsoDiscussedOtherPlaces: lake.alsoDiscussedOtherPlaces }).toEqual(X.locations.lakeB);
    expect({ interviews: road.interviews, alsoDiscussedOtherPlaces: road.alsoDiscussedOtherPlaces }).toEqual(X.locations.roadC);
    expect((lake.interviews ?? 0) + (road.interviews ?? 0)).toBe(32);          // 18 + 14: overlapping, must not be read as 32 people
    expect(lake.overlapNote).toMatch(/must not be added together/);
  });
  it("changing inputs flips the result (the fixtures are sensitive, not tautological)", () => {
    const withdrawn = records.map((r) => (r.id === "S01" ? { ...r, withdrawn: true } : r));
    expect(stakeholderDistribution(withdrawn, period).analysed).toBe(25);
    // two unknowns become shopkeepers: shopkeeper 6 is now safe to show, so nothing needs hiding
    const reclassified = records.map((r) => (r.id === "U01" || r.id === "U02" ? { ...r, stakeholder: "shopkeeper" } : r));
    const d = stakeholderDistribution(reclassified, period);
    expect(d.categories.shown).toEqual([{ code: "resident", count: 12 }, { code: "shopkeeper", count: 6 }, { code: "worker", count: 8 }]);
    expect(d.categories.suppressedCount).toBe(0);
  });
});
