import { describe, expect, it } from "vitest";
import { csvCell, exportFeatures, IMPORT_LIMITS, validateImport, type ExportFeature, type ImportMeta } from "./index.js";

// Synthetic geometry around [10,10] (not Makarba).
const META: ImportMeta = { source: "Synthetic test file", licence: "CC0-1.0", bounds: [9.9, 9.9, 10.1, 10.1] };
const fc = (features: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ type: "FeatureCollection", features, ...extra });
const feat = (geometry: unknown, properties: Record<string, unknown> = { name: "Synthetic place" }) => ({ type: "Feature", geometry, properties });
const pt = (x = 10, y = 10) => feat({ type: "Point", coordinates: [x, y] });
const sq = [[10, 10], [10.01, 10], [10.01, 10.01], [10, 10.01], [10, 10]];
const reasons = (text: string, meta = META) => { const r = validateImport(text, meta); return [...r.fileReasons, ...r.features.flatMap((f) => f.reasons)]; };

describe("import: accept path", () => {
  it("accepts valid points, lines and polygons and stages only allowlisted properties plus source and licence", () => {
    const r = validateImport(fc([
      feat({ type: "Point", coordinates: [10, 10] }, { name: "A", category: "heritage", internal_note: "drop me" }),
      feat({ type: "LineString", coordinates: [[10, 10], [10.01, 10.01]] }),
      feat({ type: "Polygon", coordinates: [sq] }),
    ]), META);
    expect(r.verdict).toBe("accepted");
    expect(r.counts).toEqual({ total: 3, accepted: 3, rejected: 0, outsideBounds: 0 });
    expect(r.accepted[0]!.properties).toEqual({ name: "A", category: "heritage", source: "Synthetic test file", licence: "CC0-1.0" });
    expect(r.features[0]!.droppedProperties).toEqual(["internal_note"]);
  });
  it("outside-bounds features are accepted with a warning and are not moved", () => {
    const r = validateImport(fc([pt(50, 50)]), META);
    expect(r.verdict).toBe("accepted");
    expect(r.counts.outsideBounds).toBe(1);
    expect(r.features[0]!.warnings[0]).toMatch(/outside the study bounds/);
    expect((r.accepted[0]!.geometry.coordinates as number[])).toEqual([50, 50]);
  });
});

describe("import: file-level rejection", () => {
  it("missing source, unapproved or empty licence", () => {
    expect(reasons(fc([pt()]), { ...META, source: "  " })).toContain("source is required");
    expect(reasons(fc([pt()]), { ...META, licence: "all-rights-reserved" })[0]).toMatch(/not on the approved list/);
    expect(reasons(fc([pt()]), { ...META, licence: "" })[0]).toMatch(/not on the approved list/);
  });
  it("not JSON, not a FeatureCollection, empty, too many features, too large", () => {
    expect(reasons("{oops")).toEqual(["file is not valid JSON"]);
    expect(reasons(JSON.stringify({ type: "Feature" }))).toEqual(["expected a GeoJSON FeatureCollection"]);
    expect(reasons(fc([]))).toEqual(["file contains no features"]);
    expect(reasons(fc(Array.from({ length: IMPORT_LIMITS.maxFeatures + 1 }, () => pt())))[0]).toMatch(/more than 500 features/);
    expect(reasons(fc([pt()], { pad: "x".repeat(IMPORT_LIMITS.maxBytes) }))[0]).toMatch(/larger than/);
  });
  it("a non-WGS84 coordinate system is rejected, WGS84 declarations are accepted", () => {
    expect(reasons(fc([pt()], { crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::32643" } } }))[0]).toMatch(/not WGS 84/);
    expect(validateImport(fc([pt()], { crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } } }), META).verdict).toBe("accepted");
    expect(validateImport(fc([pt()], { crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } } }), META).verdict).toBe("accepted");
  });
  it("a rejected file stages nothing, even if some features were fine", () => {
    const r = validateImport(fc([pt(), feat({ type: "Point", coordinates: [999, 1] })]), META);
    expect(r.verdict).toBe("rejected");
    expect(r.accepted).toEqual([]);
    expect(r.counts).toMatchObject({ accepted: 1, rejected: 1 });
  });
});

describe("import: malformed geometry", () => {
  const bad: [string, unknown, RegExp][] = [
    ["projected metres", { type: "Point", coordinates: [500000, 2000000] }, /outside longitude/],
    ["latitude over 90 (swapped)", { type: "Point", coordinates: [10, 120] }, /outside longitude/],
    ["NaN", { type: "Point", coordinates: [null, 1] }, /numeric/],
    ["string coordinates", { type: "Point", coordinates: ["10", "10"] }, /numeric/],
    ["one-position line", { type: "LineString", coordinates: [[10, 10]] }, /at least 2/],
    ["unclosed ring", { type: "Polygon", coordinates: [[[10, 10], [10.01, 10], [10.01, 10.01], [10, 10.01]]] }, /not closed|at least 4/],
    ["three-position ring", { type: "Polygon", coordinates: [[[10, 10], [10.01, 10], [10, 10]]] }, /at least 4/],
    ["bow-tie polygon", { type: "Polygon", coordinates: [[[10, 10], [10.01, 10.01], [10.01, 10], [10, 10.01], [10, 10]]] }, /crosses itself/],
    ["empty coordinates", { type: "Point", coordinates: [] }, /numeric/],
    ["GeometryCollection", { type: "GeometryCollection", geometries: [] }, /unsupported geometry type/],
    ["unknown type", { type: "Circle", coordinates: [1, 1] }, /unsupported geometry type/],
    ["4D position", { type: "Point", coordinates: [1, 1, 1, 1] }, /numeric/],
  ];
  it.each(bad)("rejects %s", (_n, g, re) => { expect(reasons(fc([feat(g)])).join(" | ")).toMatch(re); });
  it("rejects missing geometry, non-features, and missing name", () => {
    expect(reasons(fc([{ type: "Feature", geometry: null, properties: { name: "x" } }]))).toContain("no geometry");
    expect(reasons(fc([{ type: "Point" }]))).toContain("not a Feature");
    expect(reasons(fc([feat({ type: "Point", coordinates: [10, 10] }, {})]))).toContain("name is required");
    expect(reasons(fc([feat({ type: "Point", coordinates: [10, 10] }, { name: "  " })]))).toContain("name is required");
  });
  it("a valid ring that merely touches itself at the start is accepted (no false positive)", () => {
    expect(validateImport(fc([feat({ type: "Polygon", coordinates: [sq] })]), META).verdict).toBe("accepted");
  });
  it("rejects participant-private fields hidden in properties", () => {
    const r = reasons(fc([feat({ type: "Point", coordinates: [10, 10] }, { name: "x", interviewLatitude: 10.1 })]));
    expect(r.join()).toMatch(/restricted field/);
  });
});

describe("export", () => {
  const f = (id: string, o: Partial<ExportFeature> = {}): ExportFeature => ({ id, geometry: { type: "Point", coordinates: [10, 10] }, properties: { name: "A", category: "heritage", source: "S", licence: "CC0-1.0" }, ...o });
  const req = { format: "geojson" as const, purpose: "Community map review", fields: ["id", "name", "category"] };
  it("exports only requested allowlisted fields and returns an audit record without coordinates", () => {
    const r = exportFeatures([f("1")], req);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = JSON.parse(r.body);
    expect(doc.features[0].properties).toEqual({ name: "A", category: "heritage" });
    expect(doc.features[0].id).toBe("1");
    expect(r.audit).toEqual({ purpose: "Community map review", format: "geojson", fields: ["id", "name", "category"], rows: 1 });
    expect(JSON.stringify(r.audit)).not.toContain("10");
  });
  it("private rows, restricted properties, and malformed geometry reject the whole export (no partial file)", () => {
    for (const bad of [f("p", { access: "private" }), f("l", { properties: { name: "x", interviewLatitude: 1 } }), f("g", { geometry: { type: "Point", coordinates: "oops" } })]) {
      const r = exportFeatures([f("1"), bad], req);
      expect(r.ok).toBe(false);
    }
  });
  it("requires a purpose, rejects fields outside the allowlist, empty field list and oversize selections", () => {
    expect(exportFeatures([f("1")], { ...req, purpose: " " })).toEqual({ ok: false, reasons: ["a stated purpose is required"] });
    expect(exportFeatures([f("1")], { ...req, fields: ["name", "researcherId", "answers"] })).toEqual({ ok: false, reasons: ["fields not allowed in exports: researcherId, answers"] });
    expect(exportFeatures([f("1")], { ...req, fields: [] }).ok).toBe(false);
    const many = Array.from({ length: 1001 }, (_, i) => f(String(i)));
    expect(exportFeatures(many, req).ok).toBe(false);
    expect(exportFeatures(many.slice(0, 1000), req).ok).toBe(true);
  });
  it("CSV neutralises spreadsheet formulas and quotes special characters", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    for (const s of ["+1", "-2", "@cmd", "\tx", "\rx"]) expect(csvCell(s).replace(/^"/, "")[0]).toBe("'");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
    const r = exportFeatures([f("1", { properties: { name: "=1+1", category: "c" } })], { format: "csv", purpose: "Community map review", fields: ["id", "name"] });
    expect(r.ok && r.body).toBe("id,name\r\n1,'=1+1\r\n");
  });
});
