import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REGISTRY_PATH, checkRegistryOnDisk, importLayer, importMeasurement, readRegistry } from "./historical-fs.js";
import { validateRegistry, type MeasurementSeries, type PastLayerMeta } from "./historical.js";

// Synthetic fixtures, created in a temporary folder only. The shipped data folder is never modified by these tests.
const SHIPPED = resolve(process.cwd(), "../../data");
const NOW = new Date("2026-11-22");
const meta = (o: Partial<PastLayerMeta> = {}): PastLayerMeta => ({
  id: "water-tank", kind: "water", title: "Synthetic water test layer", status: "observed",
  source: { title: "Synthetic test source", url: "https://example.org/synthetic" }, licence: "CC0-1.0", crs: "EPSG:4326",
  asOf: { year: 2020, precision: "year" }, accessed: "2026-11-22", method: "Hand-made test geometry", confidence: "low", limitations: "Synthetic: not real.",
  coverage: [72.49, 22.97, 72.52, 23.01], ...o,
});
const water = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Test tank" }, geometry: { type: "Polygon", coordinates: [[[72.5, 22.99], [72.51, 22.99], [72.51, 23], [72.5, 23], [72.5, 22.99]]] } }] });

let dir = "";
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "past-")); cpSync(join(SHIPPED, "geo/past"), join(dir, "geo/past"), { recursive: true }); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("shipped registry", () => {
  it("is valid and lists every missing layer with its evidence requirement", () => {
    const reg = readRegistry(SHIPPED);
    expect(validateRegistry(reg)).toEqual([]);
    expect(reg.slots.filter((s) => s.kind === "tp-boundary")).toHaveLength(8);
    expect(reg.slots.every((s) => s.evidenceRequired.length > 40 && s.acceptableSources.length > 0)).toBe(true);
  });
  it("holds no synthetic or unsourced layer", () => {
    const reg = readRegistry(SHIPPED);
    for (const l of reg.layers) {
      expect(l.meta.source.url).toMatch(/^https:/);
      expect(`${l.meta.source.title} ${l.meta.title}`).not.toMatch(/synthetic/i);
      expect(l.meta.method.length).toBeGreaterThan(5);
    }
  });
  it("is consistent on disk", () => expect(checkRegistryOnDisk(SHIPPED)).toEqual([]));
});

describe("importLayer", () => {
  it("validates, normalises, hashes, writes the layer and moves its slot into layers", () => {
    const out = importLayer(dir, water, meta(), { now: NOW });
    expect(out.ok).toBe(true);
    const reg = readRegistry(dir);
    expect(reg.layers.map((l) => l.id)).toEqual(["water-tank"]);
    expect(reg.slots.some((s) => s.id === "water-tank")).toBe(false);
    const stored = JSON.parse(readFileSync(join(dir, "geo/past/water-tank.geojson"), "utf8"));
    expect(stored._provenance.licence).toBe("CC0-1.0");
    expect(checkRegistryOnDisk(dir)).toEqual([]);
  });
  it("writes nothing when validation fails", () => {
    const before = readFileSync(join(dir, REGISTRY_PATH), "utf8");
    const out = importLayer(dir, water, meta({ licence: "All rights reserved" }), { now: NOW });
    expect(out.ok).toBe(false);
    expect(readFileSync(join(dir, REGISTRY_PATH), "utf8")).toBe(before);
    expect(existsSync(join(dir, "geo/past/water-tank.geojson"))).toBe(false);
  });
  it("refuses to overwrite an existing layer unless replace is passed", () => {
    expect(importLayer(dir, water, meta(), { now: NOW }).ok).toBe(true);
    const again = importLayer(dir, water, meta(), { now: NOW });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reasons.join()).toMatch(/already registered/);
    expect(importLayer(dir, water, meta(), { now: NOW, replace: true }).ok).toBe(true);
  });
  it("refuses a layer whose kind does not match the slot it fills", () => {
    const out = importLayer(dir, water, meta({ kind: "green" }), { now: NOW });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reasons.join()).toMatch(/expects kind water/);
  });
  it("leaves no temporary files behind", () => {
    importLayer(dir, water, meta(), { now: NOW });
    expect(existsSync(join(dir, REGISTRY_PATH + ".tmp"))).toBe(false);
  });
});

describe("checkRegistryOnDisk", () => {
  it("detects a hand-edited layer file", () => {
    importLayer(dir, water, meta(), { now: NOW });
    const f = join(dir, "geo/past/water-tank.geojson");
    writeFileSync(f, readFileSync(f, "utf8").replace("Test tank", "Edited"), "utf8");
    expect(checkRegistryOnDisk(dir).join()).toMatch(/does not match its recorded sha256/);
  });
  it("detects a missing layer file", () => {
    importLayer(dir, water, meta(), { now: NOW });
    rmSync(join(dir, "geo/past/water-tank.geojson"));
    expect(checkRegistryOnDisk(dir).join()).toMatch(/is missing/);
  });
});

const series = (o: Partial<MeasurementSeries> = {}): MeasurementSeries => ({
  id: "synthetic-series", title: "Synthetic series", unit: "ha", method: "test", limits: "test", sameAreaAndDefinition: true,
  source: { title: "s", url: "https://example.org/s", tier: "primary", accessed: "2026-11-22" },
  points: [{ label: "B", year: 2020, value: 2, approx: false }, { label: "A", year: 2000, value: 1, approx: false }], ...o,
});
describe("importMeasurement", () => {
  it("registers a valid series, sorted by year, and keeps the registry valid", () => {
    const out = importMeasurement(dir, series());
    expect(out.ok).toBe(true);
    expect(readRegistry(dir).measurements[0]!.points.map((p) => p.year)).toEqual([2000, 2020]);
    expect(checkRegistryOnDisk(dir)).toEqual([]);
  });
  it("refuses a series that is not confirmed to cover the same area, without writing", () => {
    const before = readFileSync(join(dir, REGISTRY_PATH), "utf8");
    expect(importMeasurement(dir, series({ sameAreaAndDefinition: false })).ok).toBe(false);
    expect(readFileSync(join(dir, REGISTRY_PATH), "utf8")).toBe(before);
  });
  it("refuses to overwrite an id unless replace is passed", () => {
    importMeasurement(dir, series());
    expect(importMeasurement(dir, series()).ok).toBe(false);
    expect(importMeasurement(dir, series({ title: "Changed" }), { replace: true }).ok).toBe(true);
  });
});
