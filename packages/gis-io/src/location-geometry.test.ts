import { describe, expect, it } from "vitest";
import { planGeometryChange, validateLocationGeometry, validateProvenance } from "./location-geometry.js";

const prov = { source: "synthetic digitising exercise", method: "digitised" };
const point = { type: "Point", coordinates: [10.5, 10.5] };
const ok = (over: Record<string, unknown> = {}) => validateLocationGeometry({ crs: "EPSG:4326", geometry: point, provenance: prov, ...over });
const reasons = (r: ReturnType<typeof ok>) => (r.ok ? [] : r.reasons);

describe("location geometry validation", () => {
  it("accepts a point, a route and an area; single parts are stored as multi geometries", () => {
    expect(ok()).toMatchObject({ ok: true, geometry: { type: "Point" } });
    const line = ok({ geometry: { type: "LineString", coordinates: [[10, 10], [10.1, 10.1]] } });
    expect(line).toMatchObject({ ok: true, geometry: { type: "MultiLineString", coordinates: [[[10, 10], [10.1, 10.1]]] } });
    const area = ok({ geometry: { type: "Polygon", coordinates: [[[10, 10], [11, 10], [11, 11], [10, 10]]] } });
    expect(area).toMatchObject({ ok: true, geometry: { type: "MultiPolygon" } });
  });
  it("requires a declared WGS 84 CRS and names a mislabelled one", () => {
    expect(reasons(ok({ crs: undefined })).join()).toMatch(/crs is required/);
    expect(reasons(ok({ crs: "EPSG:3857" })).join()).toMatch(/not WGS 84/);
    expect(ok({ crs: "urn:ogc:def:crs:OGC::CRS84" }).ok).toBe(true);
  });
  it("rejects projected (metre) coordinates labelled as WGS 84 and out-of-range or swapped values", () => {
    expect(reasons(ok({ geometry: { type: "Point", coordinates: [1_113_194, 1_118_889] } })).join()).toMatch(/outside longitude/);
    expect(reasons(ok({ geometry: { type: "Point", coordinates: [10, 95] } })).join()).toMatch(/outside longitude/);
  });
  it("rejects empty, malformed, non-finite and unsupported geometry", () => {
    expect(ok({ geometry: { type: "Point", coordinates: [] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "LineString", coordinates: [] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "LineString", coordinates: [[10, 10]] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "Point", coordinates: [null, 10] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "Point", coordinates: ["10", "10"] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "GeometryCollection", coordinates: [] } }).ok).toBe(false);
    expect(ok({ geometry: { type: "MultiPoint", coordinates: [[10, 10]] } }).ok).toBe(false);
    expect(ok({ geometry: "POINT(10 10)" }).ok).toBe(false);
    expect(ok({ geometry: null }).ok).toBe(false);
  });
  it("rejects unclosed, too-short and self-intersecting polygon rings", () => {
    const bow = { type: "Polygon", coordinates: [[[10, 10], [11, 11], [11, 10], [10, 11], [10, 10]]] };
    expect(reasons(ok({ geometry: bow })).join()).toMatch(/crosses itself/);
    expect(reasons(ok({ geometry: { type: "Polygon", coordinates: [[[10, 10], [11, 10], [11, 11], [10.5, 10.5]]] } })).join()).toMatch(/not closed/);
    expect(reasons(ok({ geometry: { type: "Polygon", coordinates: [[[10, 10], [11, 10], [10, 10]]] } })).join()).toMatch(/at least 4/);
  });
  it("requires provenance with a source and an allowed method", () => {
    expect(reasons(ok({ provenance: undefined })).join()).toMatch(/provenance is required/);
    expect(reasons(ok({ provenance: { method: "digitised" } })).join()).toMatch(/source is required/);
    expect(reasons(ok({ provenance: { source: "x", method: "guessed" } })).join()).toMatch(/method must be one of/);
  });
  it("imported geometry needs an approved licence; capture date must be real and not in the future", () => {
    expect(validateProvenance({ source: "file", method: "imported" }).ok).toBe(false);
    expect(validateProvenance({ source: "file", method: "imported", licence: "CC0-1.0" }).ok).toBe(true);
    expect(validateProvenance({ source: "file", method: "imported", licence: "proprietary" }).ok).toBe(false);
    const now = new Date("2026-11-08T00:00:00Z");
    expect(validateProvenance({ source: "s", method: "surveyed", capturedOn: "2026-02-30" }, now).ok).toBe(false);
    expect(validateProvenance({ source: "s", method: "surveyed", capturedOn: "2027-01-01" }, now).ok).toBe(false);
    expect(validateProvenance({ source: "s", method: "surveyed", capturedOn: "2026-11-01" }, now).ok).toBe(true);
  });
  it("never copies unknown provenance fields into the stored value", () => {
    const r = validateProvenance({ source: "s", method: "surveyed", evil: "x" });
    expect(r).toEqual({ ok: true, value: { source: "s", method: "surveyed" } });
  });
});

describe("versioned changes", () => {
  const cur = { id: "a", revision: 3, geometry: point, provenance: { source: "s", method: "digitised" as const } };
  it("a stale revision is refused and reports the current one", () => {
    expect(planGeometryChange(cur, 2, { geometry: point, provenance: cur.provenance })).toEqual({ kind: "stale", currentRevision: 3 });
    expect(planGeometryChange(cur, 3.5, { geometry: point, provenance: cur.provenance })).toEqual({ kind: "stale", currentRevision: 3 });
  });
  it("an identical resubmission is a no-op, a real change is the next revision", () => {
    expect(planGeometryChange(cur, 3, { geometry: point, provenance: cur.provenance })).toEqual({ kind: "unchanged" });
    expect(planGeometryChange(cur, 3, { geometry: { type: "Point", coordinates: [10.6, 10.5] }, provenance: cur.provenance })).toEqual({ kind: "change", nextRevision: 4 });
  });
});
