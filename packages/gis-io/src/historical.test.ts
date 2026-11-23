import { describe, expect, it } from "vitest";
import { PAST_PROPERTY_ALLOWLIST, STUDY_BOUNDS, validateLayerMeta, validateMeasurementSeries, validatePastLayer, validateRegistry, type MeasurementSeries, type PastLayerMeta, type PastRegistry } from "./historical.js";
import { toUtm43 } from "./projection.js";

// SYNTHETIC fixtures for automated tests only. They are not historical evidence and are never published.
const NOW = new Date("2026-11-22");
const meta = (o: Partial<PastLayerMeta> = {}): PastLayerMeta => ({
  id: "synthetic-roads", kind: "roads", title: "Synthetic road test layer", status: "observed",
  source: { title: "Synthetic test source", url: "https://example.org/synthetic" }, licence: "CC0-1.0", crs: "EPSG:4326",
  asOf: { year: 2020, precision: "year" }, accessed: "2026-11-22", method: "Hand-made test geometry", confidence: "low", limitations: "Synthetic: not real.",
  coverage: [72.49, 22.97, 72.52, 23.01], ...o,
});
const fc = (features: unknown[], crs?: string) => JSON.stringify({ type: "FeatureCollection", ...(crs ? { crs: { type: "name", properties: { name: crs } } } : {}), features });
const line = (c: number[][], props: Record<string, unknown> = { name: "Test road" }, id?: string) => ({ type: "Feature", ...(id ? { id } : {}), properties: props, geometry: { type: "LineString", coordinates: c } });
const poly = (c: number[][], props: Record<string, unknown> = {}) => ({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [c] } });
const SQ = [[72.5, 22.99], [72.51, 22.99], [72.51, 23], [72.5, 23], [72.5, 22.99]];
const reasons = (r: { reasons: string[] }) => r.reasons.join(" | ");

describe("validateLayerMeta", () => {
  it("accepts complete metadata", () => expect(validateLayerMeta(meta(), NOW)).toEqual([]));
  it("accepts today's date written east of UTC but not a date two days ahead", () => {
    const eveningUtc = new Date("2026-11-23T20:46:00Z"); // already 24 November in India (UTC+5:30)
    expect(validateLayerMeta(meta({ accessed: "2026-11-24" }), eveningUtc)).toEqual([]);
    expect(validateLayerMeta(meta({ accessed: "2026-11-25" }), eveningUtc).join()).toMatch(/in the future/);
  });
  it.each([
    ["missing source URL", { source: { title: "x", url: "http://insecure" } }, /source needs/],
    ["unapproved licence", { licence: "All rights reserved" }, /not on the approved list/],
    ["unknown status", { status: "built" as never }, /status must be/],
    ["future year", { asOf: { year: 2030, precision: "year" as const } }, /asOf.year/],
    ["no limitations", { limitations: " " }, /limitations are required/],
    ["access date in the future", { accessed: "2027-01-01" }, /in the future/],
    ["unsupported crs", { crs: "EPSG:27700" as never }, /crs must be/],
    ["coverage outside the study area", { coverage: [70, 20, 74, 25] as const }, /outside the study area/],
    ["tp boundary without a scheme", { kind: "tp-boundary" as const }, /needs schemeId/],
    ["unlabelled reconstruction", { status: "reconstruction" as const }, /must say so/],
    ["poor georeferencing", { georeferencing: { method: "gcp", controlPoints: 6, rmseMetres: 60 } }, /above the 25 m limit/],
    ["too few control points", { georeferencing: { method: "gcp", controlPoints: 2, rmseMetres: 5 } }, /at least 4 control points/],
  ])("rejects %s", (_n, o, re) => expect(validateLayerMeta(meta(o as Partial<PastLayerMeta>), NOW).join(" ")).toMatch(re as RegExp));
  it("rejects missing metadata", () => expect(validateLayerMeta(null)).toEqual(["metadata is missing"]));
});

describe("validatePastLayer: acceptance and normalisation", () => {
  it("accepts a valid road layer and keeps only allowlisted properties", () => {
    const r = validatePastLayer(fc([line([[72.5, 22.99], [72.51, 23]], { name: "A", class: "x", secret: "drop me" }, "r1")]), meta(), NOW);
    expect(r.verdict).toBe("accepted");
    expect(r.layer!.features[0]!.properties).toEqual({ name: "A", class: "x" });
    expect(r.counts.droppedProperties).toBe(1);
    expect(r.warnings.join(" ")).toMatch(/dropped/);
  });
  it("reprojects UTM 43N input to WGS 84", () => {
    const a = toUtm43(72.5, 22.99), b = toUtm43(72.51, 23);
    const r = validatePastLayer(fc([line([a, b])], "urn:ogc:def:crs:EPSG::32643"), meta({ crs: "EPSG:32643" }), NOW);
    expect(r.verdict).toBe("accepted");
    expect(r.reprojected).toBe(true);
    expect((r.layer!.features[0]!.geometry.coordinates as number[][])[0]![0]).toBeCloseTo(72.5, 6);
  });
  it("accepts polygon layers for areas and a land-use class", () => {
    expect(validatePastLayer(fc([poly(SQ, { class: "residential" })]), meta({ kind: "landuse" }), NOW).verdict).toBe("accepted");
    expect(validatePastLayer(fc([poly(SQ)]), meta({ kind: "water" }), NOW).verdict).toBe("accepted");
  });
  it("stamps the scheme id onto tp-boundary features", () => {
    const r = validatePastLayer(fc([poly(SQ, { name: "x" })]), meta({ kind: "tp-boundary", schemeId: "tp-84b", status: "sanctioned" }), NOW);
    expect(r.layer!.features[0]!.properties["scheme_id"]).toBe("tp-84b");
  });
});

describe("validatePastLayer: rejection with clear reasons", () => {
  it("rejects invalid metadata before reading the file", () => expect(reasons(validatePastLayer("not json", meta({ licence: "x" }), NOW))).toMatch(/licence/));
  it("rejects non-JSON and non-FeatureCollection input", () => {
    expect(reasons(validatePastLayer("{oops", meta(), NOW))).toMatch(/not valid JSON/);
    expect(reasons(validatePastLayer(JSON.stringify({ type: "Feature" }), meta(), NOW))).toMatch(/FeatureCollection/);
    expect(reasons(validatePastLayer(fc([]), meta(), NOW))).toMatch(/no features/);
  });
  it("rejects a file whose declared coordinate system disagrees with the metadata", () =>
    expect(reasons(validatePastLayer(fc([line([[72.5, 22.99], [72.51, 23]])], "urn:ogc:def:crs:EPSG::3857"), meta(), NOW))).toMatch(/must agree/));
  it("rejects projected coordinates mislabelled as WGS 84", () => {
    const [x, y] = toUtm43(72.5, 22.99);
    expect(reasons(validatePastLayer(fc([line([[x, y], [x + 100, y]])]), meta(), NOW))).toMatch(/outside longitude/);
  });
  it("rejects swapped latitude/longitude as outside the study area", () =>
    expect(reasons(validatePastLayer(fc([line([[22.99, 72.5], [23, 72.51]])]), meta(), NOW))).toMatch(/outside longitude|outside the study area/));
  it("rejects the wrong geometry type for the kind", () => {
    expect(reasons(validatePastLayer(fc([poly(SQ)]), meta(), NOW))).toMatch(/needs line geometry/);
    expect(reasons(validatePastLayer(fc([line([[72.5, 22.99], [72.51, 23]])]), meta({ kind: "water" }), NOW))).toMatch(/needs polygon geometry/);
  });
  it("rejects geometry outside the declared coverage and outside the study area", () => {
    expect(reasons(validatePastLayer(fc([line([[72.5, 22.99], [72.55, 23]])]), meta(), NOW))).toMatch(/outside the declared coverage/);
    expect(reasons(validatePastLayer(fc([line([[72.3, 22.99], [72.31, 23]])]), meta(), NOW))).toMatch(/outside the study area/);
  });
  it("rejects a self-crossing or unclosed polygon", () => {
    expect(reasons(validatePastLayer(fc([poly([[72.5, 22.99], [72.51, 23], [72.51, 22.99], [72.5, 23], [72.5, 22.99]])]), meta({ kind: "water" }), NOW))).toMatch(/crosses itself/);
    expect(reasons(validatePastLayer(fc([poly([[72.5, 22.99], [72.51, 22.99], [72.51, 23], [72.5, 23]])]), meta({ kind: "water" }), NOW))).toMatch(/not closed/);
  });
  it("rejects land-use features with no class", () => expect(reasons(validatePastLayer(fc([poly(SQ)]), meta({ kind: "landuse" }), NOW))).toMatch(/need a class/));
  it("rejects restricted (personal or private) fields", () =>
    expect(reasons(validatePastLayer(fc([line([[72.5, 22.99], [72.51, 23]], { name: "x", interview_id: "r1" })]), meta(), NOW))).toMatch(/restricted field/));
  it("rejects a repeated feature id, and drops (with a warning) an identical geometry", () => {
    const l = line([[72.5, 22.99], [72.51, 23]], { name: "a" }, "same");
    expect(reasons(validatePastLayer(fc([l, { ...l, geometry: { type: "LineString", coordinates: [[72.5, 22.99], [72.505, 23]] } }]), meta(), NOW))).toMatch(/duplicate id same/);
    const r = validatePastLayer(fc([line([[72.5, 22.99], [72.51, 23]]), line([[72.5, 22.99], [72.51, 23]], { name: "b" })]), meta(), NOW);
    expect(r.verdict).toBe("accepted"); expect(r.counts.features).toBe(1); expect(r.counts.duplicates).toBe(1);
  });
  it("rejects two different boundaries for one scheme", () => {
    const other = [[72.5, 22.98], [72.51, 22.98], [72.51, 22.99], [72.5, 22.99], [72.5, 22.98]];
    expect(reasons(validatePastLayer(fc([poly(SQ), poly(other)]), meta({ kind: "tp-boundary", schemeId: "tp-84b", status: "sanctioned" }), NOW))).toMatch(/conflicting boundary for scheme tp-84b/);
  });
  it("enforces the size limit", () => expect(reasons(validatePastLayer(" ".repeat(2_100_000), meta(), NOW))).toMatch(/larger than/));
  it("never returns a layer for a rejected file", () => expect(validatePastLayer(fc([poly(SQ)]), meta(), NOW).layer).toBeUndefined());
});

const series = (o: Partial<MeasurementSeries> = {}): MeasurementSeries => ({
  id: "synthetic-water", title: "Synthetic", unit: "ha", method: "test", limits: "test", sameAreaAndDefinition: true,
  source: { title: "s", url: "https://example.org/s", tier: "primary", accessed: "2026-11-22" },
  points: [{ label: "A", year: 2000, value: 1, approx: false }, { label: "B", year: 2020, value: 2, approx: false }], ...o,
});

describe("measurement series and registry", () => {
  it("accepts a documented series", () => expect(validateMeasurementSeries(series())).toEqual([]));
  it("requires the same area and definition, a unit, a method and a source", () => {
    expect(validateMeasurementSeries(series({ sameAreaAndDefinition: false })).join()).toMatch(/same area/);
    expect(validateMeasurementSeries(series({ unit: "" })).join()).toMatch(/unit is required/);
    expect(validateMeasurementSeries(series({ source: { title: "s", url: "", tier: "primary", accessed: "" } })).join()).toMatch(/source needs/);
  });
  it("refuses duplicate years and non-finite values", () => {
    expect(validateMeasurementSeries(series({ points: [{ label: "A", year: 2000, value: 1, approx: false }, { label: "B", year: 2000, value: 2, approx: false }] })).join()).toMatch(/share a year/);
    expect(validateMeasurementSeries(series({ points: [{ label: "A", year: 2000, value: NaN, approx: false }] })).join()).toMatch(/finite value/);
  });
  const reg = (o: Partial<PastRegistry> = {}): PastRegistry => ({ version: 1, studyBounds: [...STUDY_BOUNDS], slots: [{ id: "slot-a", kind: "roads", title: "t", status: "unavailable", evidenceRequired: "A dated road map", acceptableSources: ["AMC"] }], layers: [], measurements: [], ...o });
  it("accepts a registry of explained, unavailable slots", () => expect(validateRegistry(reg())).toEqual([]));
  it("requires an unavailable slot to state its evidence requirement", () =>
    expect(validateRegistry(reg({ slots: [{ id: "a", kind: "roads", title: "t", status: "unavailable", evidenceRequired: "", acceptableSources: [] }] })).join()).toMatch(/evidence required/));
  it("requires an available layer to carry a hash, a layer path and valid metadata", () => {
    const r = validateRegistry(reg({ layers: [{ id: "l", kind: "roads", title: "t", status: "available", file: "x.geojson", sha256: "", meta: meta({ id: "l" }), counts: { features: 1, vertices: 2, droppedProperties: 0, duplicates: 0 } }] })).join();
    expect(r).toMatch(/sha256 is missing/); expect(r).toMatch(/file must be geo\/past/);
  });
  it("exposes the property allowlist", () => expect(PAST_PROPERTY_ALLOWLIST).toContain("class"));
});
