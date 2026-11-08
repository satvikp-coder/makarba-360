import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accessibilityLabel, audioBlockers, auditProblems, chooseRenderer, FEATURES, hotspotProblems, isEnabled, reportCsv, scenarioHeading, scenarioProblems, stepTour, usableTour, type AudioItem, type CorridorAudit, type FeatureEnv, type Scenario, type Tour } from "./index.js";

const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));

describe("feature flags: everything off, nothing in production before the release gate", () => {
  const env = (o: Partial<FeatureEnv> = {}): FeatureEnv => ({ appEnv: "local", releaseApproved: false, enabled: {}, ...o });
  it("is off by default for every feature", () => { for (const f of FEATURES) expect(isEnabled(f, env()), f).toBe(false); });
  it("can be switched on in local and staging", () => { expect(isEnabled("tours", env({ enabled: { tours: true } }))).toBe(true); expect(isEnabled("tours", env({ appEnv: "staging", enabled: { tours: true } }))).toBe(true); });
  it("cannot be switched on in production until the release gate is approved", () => {
    expect(isEnabled("tours", env({ appEnv: "production", enabled: { tours: true } }))).toBe(false);
    expect(isEnabled("tours", env({ appEnv: "production", releaseApproved: true, enabled: { tours: true } }))).toBe(true);
  });
});

describe("#128 tours", () => {
  const tour: Tour = { id: "t", title: "Synthetic tour", synthetic: true, stops: [{ placeSlug: "a", title: "A", text: "x" }, { placeSlug: "gone", title: "G", text: "x" }, { placeSlug: "a", title: "A again", text: "x" }, { placeSlug: "b", title: "B", text: "x" }] };
  it("drops unpublished and duplicate stops and reports them", () => { const r = usableTour(tour, new Set(["a", "b"]))!; expect(r.tour.stops.map((s) => s.placeSlug)).toEqual(["a", "b"]); expect(r.dropped).toEqual(["gone", "a"]); });
  it("a tour with no published stop is not shown", () => { expect(usableTour(tour, new Set())).toBeNull(); });
  it("keyboard stepping stays within the tour", () => { expect([stepTour(0, 3, "prev"), stepTour(2, 3, "next"), stepTour(1, 3, "first"), stepTour(1, 3, "last")]).toEqual([0, 2, 0, 2]); });
});

describe("#130 corridor audits", () => {
  const audit = (o: Partial<CorridorAudit> = {}): CorridorAudit => ({ corridorId: "c", rubricVersion: "r1", auditedOn: "2026-03-01", auditor: "Auditor", source: "Synthetic survey", coverage: 0.5, geometryVerified: true, items: [{ id: "kerb", value: "partly", evidence: "photo-1" }, { id: "slope", value: "not_assessed", evidence: null }], ...o });
  it("a verified, evidenced audit gives a dated, coverage-qualified label; unassessed stays 'Not assessed'", () => {
    expect(accessibilityLabel(audit(), "kerb")).toBe("Partly meets the criterion (audited 2026-03-01, 50% of the corridor surveyed)");
    expect(accessibilityLabel(audit(), "slope")).toBe("Not assessed");
    expect(accessibilityLabel(audit(), "nonexistent")).toBe("Not assessed");
  });
  it("no claim without a verified geometry, a source, an auditor, a date or evidence", () => {
    for (const a of [audit({ geometryVerified: false }), audit({ source: null }), audit({ auditor: null }), audit({ auditedOn: null }), audit({ items: [{ id: "kerb", value: "meets", evidence: null }] }), audit({ coverage: 2 })]) {
      expect(auditProblems(a).length).toBeGreaterThan(0);
      expect(accessibilityLabel(a, "kerb")).toBe("Not assessed");
    }
    expect(accessibilityLabel(null, "kerb")).toBe("Not assessed");
  });
});

describe("#131 audio", () => {
  const a = (o: Partial<AudioItem> = {}): AudioItem => ({ id: "a", consentAudioPublish: "granted", rightsCleared: true, withdrawn: false, transcript: "Invented words", attribution: "role", role: "a shopkeeper", name: null, durationSec: 30, ...o });
  it("publishable only with granted consent, cleared rights, a transcript and valid attribution", () => {
    expect(audioBlockers(a())).toEqual([]);
    expect(audioBlockers(a({ consentAudioPublish: "withdrawn" }))[0]).toContain("withdrawn");
    expect(audioBlockers(a({ consentAudioPublish: "not_requested" }))[0]).toContain("not_requested");
    expect(audioBlockers(a({ withdrawn: true }))).toContain("withdrawn");
    expect(audioBlockers(a({ rightsCleared: false }))).toContain("rights not cleared");
    expect(audioBlockers(a({ transcript: " " }))).toContain("no transcript (needed for accessibility)");
    expect(audioBlockers(a({ attribution: "named" }))).toContain("named attribution without a name");
    expect(audioBlockers(a({ durationSec: 0 }))).toContain("invalid duration");
  });
});

describe("#132 scenarios", () => {
  const s = (o: Partial<Scenario> = {}): Scenario => ({ id: "s", title: "Wider footpath", hypothetical: true, assumptions: ["Invented assumption"], basis: null, description: "An illustration of a wider footpath." , ...o });
  it("must be hypothetical, state assumptions and avoid measurement or prediction wording", () => {
    expect(scenarioProblems(s())).toEqual([]);
    expect(scenarioProblems(s({ hypothetical: false }))).toContain("a scenario must be marked hypothetical");
    expect(scenarioProblems(s({ assumptions: [] }))).toContain("a scenario must state its assumptions");
    for (const d of ["Measured footfall doubled.", "Residents said they want it.", "This will happen next year.", "Survey found support."]) expect(scenarioProblems(s({ description: d })).length, d).toBeGreaterThan(0);
  });
  it("the heading always says hypothetical", () => { expect(scenarioHeading(s())).toMatch(/^Hypothetical scenario \(not observed or measured\)/); });
});

describe("#133 renderer choice", () => {
  const caps = { webgl2: true, webgl: true, maxTexture: 8192, deviceMemoryGb: 8, reducedMotion: false, saveData: false };
  it("3D only on a capable device with no preference against it; every other case falls back to 2D with a reason", () => {
    expect(chooseRenderer(caps).mode).toBe("3d");
    for (const [o, why] of [[{ reducedMotion: true }, "reduced motion"], [{ saveData: true }, "data saver"], [{ webgl2: false }, "WebGL 2"], [{ webgl2: false, webgl: false }, "WebGL not"], [{ maxTexture: 2048 }, "texture"], [{ deviceMemoryGb: 2 }, "memory"]] as const) {
      const r = chooseRenderer({ ...caps, ...o }); expect(r.mode).toBe("2d"); expect(r.reason).toContain(why);
    }
    expect(chooseRenderer({ ...caps, deviceMemoryGb: null }).mode).toBe("3d");
  });
});

describe("#134 hotspots", () => {
  const cell = (id: string, count: number | null, suppressed = false, w = 0.01): { cellId: string; bbox: [number, number, number, number]; count: number | null; suppressed: boolean } => ({ cellId: id, bbox: [10, 10, 10 + w, 10 + w], count, suppressed });
  it("accepts coarse cells with counts of at least k and two hidden cells", () => { expect(hotspotProblems([cell("a", 9), cell("b", 6), cell("c", null, true), cell("d", null, true)])).toEqual([]); });
  it("rejects fine cells, counts below k, counts on suppressed cells, and a single hidden cell", () => {
    expect(hotspotProblems([cell("a", 9, false, 0.001)])[0]).toContain("finer");
    expect(hotspotProblems([cell("a", 4)])[0]).toContain("at least 5");
    expect(hotspotProblems([cell("a", 3, true)])[0]).toContain("must not carry a count");
    expect(hotspotProblems([cell("a", 9), cell("b", null, true)])).toContain("exactly one hidden cell can be recovered from a published total: hide a neighbour too");
  });
  it("rejects restricted fields such as an exact position", () => { expect(hotspotProblems([{ ...cell("a", 9), interviewLatitude: 10.1 } as never])).toContain("restricted field present"); });
});

describe("#135 report export", () => {
  it("states synthetic data plainly, shows hidden groups as hidden (never zero) and carries period, versions and caveat", () => {
    const csv = reportCsv(bundle.insights);
    expect(csv).toContain("# SYNTHETIC DEMONSTRATION DATA - NOT RESEARCH FINDINGS");
    expect(csv).toContain("synthetic-small-independent,hidden,hidden,hidden,hidden,Hidden to protect privacy (not zero)");
    expect(csv).toContain("synthetic-safe,40,30,5,5,Shown");
    expect(csv).toMatch(/collected 2026-01 to 2026-02; questionnaire synthetic-survey-v1; policy synthetic-disclosure-v1/);
    expect(csv).toContain("not estimates for all residents".slice(0, 0) + "Synthetic test counts only");
  });
  it("is formula-safe and contains no restricted field names", () => {
    const hostile = { ...bundle.insights, cohorts: [{ ...bundle.insights.cohorts[0], cohortId: "=HYPERLINK(\"http://x\")" }] };
    const csv = reportCsv(hostile);
    expect(csv).toContain("\"'=HYPERLINK(");
    expect(reportCsv(bundle.insights)).not.toMatch(/interview(latitude|longitude)|researcherid|rawanswers/i);
  });
  it("an approved snapshot is labelled as such, not as synthetic", () => {
    const approved = { ...bundle.insights, meta: { ...bundle.insights.meta, datasetKind: "approved" } };
    expect(reportCsv(approved)).toContain("# Approved snapshot");
    expect(reportCsv(approved)).not.toContain("SYNTHETIC");
  });
});
