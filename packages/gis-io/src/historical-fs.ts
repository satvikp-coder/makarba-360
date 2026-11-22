import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateMeasurementSeries, validatePastLayer, validateRegistry, type MeasurementSeries, type PastLayerMeta, type PastRegistry, type RegistryLayer } from "./historical.js";

/**
 * File-level pipeline for historical layers. `importLayer` validates, normalises to WGS 84, hashes and registers a layer;
 * `checkRegistryOnDisk` re-verifies every registered file against its recorded hash. Writes are atomic (temp file, then rename)
 * and nothing is written when validation fails. Paths are relative to the web data folder (data/).
 */
export const REGISTRY_PATH = "geo/past/layers.json";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const stable = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
function writeAtomic(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

export function readRegistry(dataDir: string): PastRegistry {
  return JSON.parse(readFileSync(join(dataDir, REGISTRY_PATH), "utf8")) as PastRegistry;
}

export type ImportOutcome = { ok: true; layer: RegistryLayer; warnings: string[] } | { ok: false; reasons: string[] };

export function importLayer(dataDir: string, text: string, meta: PastLayerMeta, opts: { replace?: boolean; now?: Date } = {}): ImportOutcome {
  const report = validatePastLayer(text, meta, opts.now);
  if (report.verdict !== "accepted" || !report.layer) return { ok: false, reasons: report.reasons };
  const reg = readRegistry(dataDir);
  const existing = reg.layers.findIndex((l) => l.id === meta.id);
  if (existing >= 0 && !opts.replace) return { ok: false, reasons: [`a layer with id ${meta.id} is already registered; pass replace to overwrite it deliberately`] };
  if (reg.slots.some((s) => s.id === meta.id && s.kind !== meta.kind)) return { ok: false, reasons: [`the slot ${meta.id} expects kind ${reg.slots.find((s) => s.id === meta.id)!.kind}, not ${meta.kind}`] };
  const body = stable({ ...report.layer, _provenance: { id: meta.id, source: meta.source, licence: meta.licence, asOf: meta.asOf, status: meta.status, crsIn: meta.crs, accessed: meta.accessed } });
  const file = `geo/past/${meta.id}.geojson`;
  const layer: RegistryLayer = { id: meta.id, kind: meta.kind, title: meta.title, status: "available", file, sha256: sha256(body), meta, counts: report.counts };
  const next: PastRegistry = {
    ...reg,
    slots: reg.slots.filter((s) => s.id !== meta.id),
    layers: existing >= 0 ? reg.layers.map((l, i) => (i === existing ? layer : l)) : [...reg.layers, layer],
  };
  const problems = validateRegistry(next);
  if (problems.length) return { ok: false, reasons: problems };
  writeAtomic(join(dataDir, file), body);
  writeAtomic(join(dataDir, REGISTRY_PATH), stable(next));
  return { ok: true, layer, warnings: report.warnings };
}

export type MeasureOutcome = { ok: true; series: MeasurementSeries } | { ok: false; reasons: string[] };
/** Validates a measurement series (unit, method, limits, source, same area and definition, whole years) and registers it. Nothing is written on failure. */
export function importMeasurement(dataDir: string, series: MeasurementSeries, opts: { replace?: boolean } = {}): MeasureOutcome {
  const problems = validateMeasurementSeries(series);
  if (problems.length) return { ok: false, reasons: problems };
  const reg = readRegistry(dataDir);
  const at = reg.measurements.findIndex((m) => m.id === series.id);
  if (at >= 0 && !opts.replace) return { ok: false, reasons: [`a series with id ${series.id} is already registered; pass replace to overwrite it deliberately`] };
  const ordered = { ...series, points: [...series.points].sort((a, b) => a.year - b.year) };
  const next: PastRegistry = { ...reg, measurements: at >= 0 ? reg.measurements.map((m, i) => (i === at ? ordered : m)) : [...reg.measurements, ordered] };
  const all = validateRegistry(next);
  if (all.length) return { ok: false, reasons: all };
  writeAtomic(join(dataDir, REGISTRY_PATH), stable(next));
  return { ok: true, series: ordered };
}

/** Verifies the registry document and the bytes of every registered layer. Returns problems; empty means healthy. */
export function checkRegistryOnDisk(dataDir: string): string[] {
  const reg = readRegistry(dataDir);
  const problems = validateRegistry(reg);
  for (const l of reg.layers) {
    const path = join(dataDir, l.file);
    if (!existsSync(path)) { problems.push(`${l.id}: file ${l.file} is missing`); continue; }
    const text = readFileSync(path, "utf8");
    if (sha256(text) !== l.sha256) problems.push(`${l.id}: file does not match its recorded sha256 (edited by hand?)`);
    const again = validatePastLayer(JSON.stringify({ type: "FeatureCollection", features: (JSON.parse(text) as { features: unknown[] }).features }), { ...l.meta, crs: "EPSG:4326" });
    if (again.verdict !== "accepted") problems.push(`${l.id}: stored geometry no longer validates (${again.reasons[0] ?? "unknown"})`);
  }
  return problems;
}
