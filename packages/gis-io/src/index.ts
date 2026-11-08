import { findForbiddenField } from "@makarba/contracts";

/**
 * Validated GIS import and export (#31). Import checks a GeoJSON file into a staging report (accept or reject with reasons);
 * nothing is written anywhere and nothing is repaired silently. Export refuses private coordinates and neutralises
 * spreadsheet formulas. Pure functions: database writes and privileged routes belong to Developer A.
 */
export const IMPORT_LIMITS = { maxBytes: 2_000_000, maxFeatures: 500, maxVertices: 20_000, maxRingVerticesForIntersection: 2_000 } as const;
export const ALLOWED_LICENCES = ["ODbL-1.0", "CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "public-domain", "project-own"] as const;
/** Property names that survive import to staging; everything else is dropped and reported. */
export const IMPORT_PROPERTY_ALLOWLIST = ["name", "category", "slug", "description_source", "osm_id"] as const;

export type Position = number[];
export interface Geom { type: string; coordinates: unknown }
export interface ImportMeta { source: string; licence: string; bounds?: readonly [west: number, south: number, east: number, north: number] }
export interface FeatureReport { index: number; status: "accepted" | "rejected"; reasons: string[]; warnings: string[]; droppedProperties: string[] }
export interface ImportReport {
  verdict: "accepted" | "rejected"; fileReasons: string[]; features: FeatureReport[];
  accepted: { type: "Feature"; geometry: Geom; properties: Record<string, unknown> }[];
  counts: { total: number; accepted: number; rejected: number; outsideBounds: number };
}

const GEOM_TYPES = ["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"];
const isPos = (p: unknown): p is Position => Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every((n) => typeof n === "number");

function reject(fileReasons: string[], total = 0): ImportReport {
  return { verdict: "rejected", fileReasons, features: [], accepted: [], counts: { total, accepted: 0, rejected: total, outsideBounds: 0 } };
}

export function validateImport(text: string, meta: ImportMeta): ImportReport {
  const file: string[] = [];
  if (!meta.source || !meta.source.trim()) file.push("source is required");
  if (!(ALLOWED_LICENCES as readonly string[]).includes(meta.licence)) file.push(`licence "${meta.licence}" is not on the approved list (${ALLOWED_LICENCES.join(", ")})`);
  if (new TextEncoder().encode(text).length > IMPORT_LIMITS.maxBytes) file.push(`file is larger than ${IMPORT_LIMITS.maxBytes} bytes`);
  if (file.length) return reject(file);
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return reject(["file is not valid JSON"]); }
  const d = doc as { type?: unknown; features?: unknown; crs?: { properties?: { name?: unknown } } };
  if (!d || typeof d !== "object" || d.type !== "FeatureCollection" || !Array.isArray(d.features)) return reject(["expected a GeoJSON FeatureCollection"]);
  if (d.crs !== undefined) {
    const name = String(d.crs?.properties?.name ?? "");
    if (!/(CRS84|EPSG::?4326)$/i.test(name)) return reject([`coordinate system "${name || "unknown"}" is not WGS 84 (EPSG:4326); reproject before importing`], d.features.length);
  }
  if (d.features.length === 0) return reject(["file contains no features"]);
  if (d.features.length > IMPORT_LIMITS.maxFeatures) return reject([`more than ${IMPORT_LIMITS.maxFeatures} features; split the file`], d.features.length);

  let vertices = 0, outside = 0;
  const features: FeatureReport[] = [];
  const accepted: ImportReport["accepted"] = [];
  d.features.forEach((raw, index) => {
    const reasons: string[] = [], warnings: string[] = [], dropped: string[] = [];
    const f = raw as { type?: unknown; geometry?: Geom | null; properties?: Record<string, unknown> | null };
    if (!f || f.type !== "Feature") reasons.push("not a Feature");
    else if (!f.geometry) reasons.push("no geometry");
    else {
      const leak = findForbiddenField(f.properties ?? {});
      if (leak) reasons.push(`contains a restricted field (${leak.replace(/^\./, "")})`);
      const n = checkGeometry(f.geometry, reasons);
      vertices += n;
      if (vertices > IMPORT_LIMITS.maxVertices) reasons.push(`file exceeds ${IMPORT_LIMITS.maxVertices} vertices in total`);
      const props = f.properties ?? {};
      for (const k of Object.keys(props)) if (!(IMPORT_PROPERTY_ALLOWLIST as readonly string[]).includes(k)) dropped.push(k);
      if (typeof props["name"] !== "string" || !(props["name"] as string).trim()) reasons.push("name is required");
      if (!reasons.length && meta.bounds && !touchesBounds(f.geometry, meta.bounds)) { warnings.push("outside the study bounds; needs lead review, not moved or clipped"); outside++; }
    }
    const ok = reasons.length === 0;
    features.push({ index, status: ok ? "accepted" : "rejected", reasons, warnings, droppedProperties: dropped });
    if (ok) {
      const props = f.properties ?? {};
      accepted.push({ type: "Feature", geometry: f.geometry as Geom, properties: { ...Object.fromEntries(IMPORT_PROPERTY_ALLOWLIST.filter((k) => k in props).map((k) => [k, props[k]])), source: meta.source.trim(), licence: meta.licence } });
    }
  });
  const nAcc = accepted.length;
  return { verdict: nAcc === features.length ? "accepted" : "rejected", fileReasons: [], features, accepted: nAcc === features.length ? accepted : [], counts: { total: features.length, accepted: nAcc, rejected: features.length - nAcc, outsideBounds: outside } };
}

export function checkGeometry(g: Geom, reasons: string[]): number {
  if (!GEOM_TYPES.includes(g.type)) { reasons.push(`unsupported geometry type ${String(g.type)}`); return 0; }
  const parts: { kind: "point" | "line" | "ring"; pts: unknown }[] = [];
  const c = g.coordinates;
  switch (g.type) {
    case "Point": parts.push({ kind: "point", pts: [c] }); break;
    case "MultiPoint": if (Array.isArray(c)) parts.push({ kind: "point", pts: c }); break;
    case "LineString": parts.push({ kind: "line", pts: c }); break;
    case "MultiLineString": if (Array.isArray(c)) c.forEach((l) => parts.push({ kind: "line", pts: l })); break;
    case "Polygon": if (Array.isArray(c)) c.forEach((r) => parts.push({ kind: "ring", pts: r })); break;
    case "MultiPolygon": if (Array.isArray(c)) c.forEach((p) => Array.isArray(p) && p.forEach((r) => parts.push({ kind: "ring", pts: r }))); break;
  }
  if (!parts.length) { reasons.push("geometry has no coordinates"); return 0; }
  let count = 0;
  for (const part of parts) {
    const pts = part.pts;
    if (!Array.isArray(pts) || pts.length === 0) { reasons.push("empty coordinate list"); continue; }
    if (!pts.every(isPos)) { reasons.push("coordinates must be numeric [longitude, latitude] pairs"); continue; }
    count += pts.length;
    const bad = pts.find((p) => !p.every(Number.isFinite));
    if (bad) { reasons.push("coordinates must be finite numbers"); continue; }
    const out = pts.find((p) => Math.abs(p[0]!) > 180 || Math.abs(p[1]!) > 90);
    if (out) { reasons.push("coordinates are outside longitude -180..180 / latitude -90..90 (projected or swapped?)"); continue; }
    if (part.kind === "line" && pts.length < 2) reasons.push("a line needs at least 2 positions");
    if (part.kind === "ring") {
      if (pts.length < 4) reasons.push("a polygon ring needs at least 4 positions");
      else if (pts[0]![0] !== pts[pts.length - 1]![0] || pts[0]![1] !== pts[pts.length - 1]![1]) reasons.push("polygon ring is not closed");
      else if (pts.length <= IMPORT_LIMITS.maxRingVerticesForIntersection && selfIntersects(pts)) reasons.push("polygon ring crosses itself");
      else if (pts.length > IMPORT_LIMITS.maxRingVerticesForIntersection) reasons.push("polygon ring too large to validate");
    }
  }
  return count;
}

/** True when two non-adjacent edges of a closed ring properly cross. */
function selfIntersects(r: Position[]): boolean {
  const n = r.length - 1;
  const ccw = (a: Position, b: Position, c: Position) => (c[1]! - a[1]!) * (b[0]! - a[0]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = r[i]!, b = r[i + 1]!, c = r[j]!, d = r[j + 1]!;
    if (ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0) return true;
  }
  return false;
}

function touchesBounds(g: Geom, b: readonly [number, number, number, number]): boolean {
  let hit = false;
  const walk = (c: unknown) => { if (isPos(c)) { if (c[0]! >= b[0] && c[0]! <= b[2] && c[1]! >= b[1] && c[1]! <= b[3]) hit = true; } else if (Array.isArray(c)) c.forEach(walk); };
  walk(g.coordinates);
  return hit;
}

// ---------------------------------------------------------------- export

export interface ExportFeature { id: string; geometry: Geom; properties: Record<string, unknown>; access?: "public" | "private" }
export interface ExportRequest { format: "geojson" | "csv"; purpose: string; fields: string[]; maxRows?: number }
export type ExportResult =
  | { ok: true; body: string; audit: { purpose: string; format: string; fields: string[]; rows: number } }
  | { ok: false; reasons: string[] };
export const EXPORT_FIELD_ALLOWLIST = ["id", "name", "category", "slug", "source", "licence"] as const;
export const EXPORT_MAX_ROWS = 1000;

/** Neutralise spreadsheet formulas and quote for CSV. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportFeatures(features: ExportFeature[], req: ExportRequest): ExportResult {
  const why: string[] = [];
  if (!req.purpose || req.purpose.trim().length < 5) why.push("a stated purpose is required");
  const bad = req.fields.filter((f) => !(EXPORT_FIELD_ALLOWLIST as readonly string[]).includes(f));
  if (bad.length) why.push(`fields not allowed in exports: ${bad.join(", ")}`);
  if (!req.fields.length) why.push("choose at least one field");
  const max = Math.min(req.maxRows ?? EXPORT_MAX_ROWS, EXPORT_MAX_ROWS);
  if (features.length > max) why.push(`more than ${max} rows; narrow the selection`);
  features.forEach((f, i) => {
    if (f.access === "private") why.push(`row ${i + 1} (${f.id}) is private and cannot be exported`);
    else if (findForbiddenField(f.properties) !== null) why.push(`row ${i + 1} (${f.id}) carries a restricted field`);
    const g = f.geometry;
    if (!GEOM_TYPES.includes(g.type) || !(g.type === "Point" ? isPos(g.coordinates) : Array.isArray(g.coordinates))) why.push(`row ${i + 1} (${f.id}) has malformed geometry`);
  });
  if (why.length) return { ok: false, reasons: why };
  const val = (f: ExportFeature, k: string) => (k === "id" ? f.id : f.properties[k]);
  const audit = { purpose: req.purpose.trim(), format: req.format, fields: [...req.fields], rows: features.length };
  if (req.format === "geojson") {
    const body = JSON.stringify({ type: "FeatureCollection", features: features.map((f) => ({ type: "Feature", id: f.id, geometry: f.geometry, properties: Object.fromEntries(req.fields.filter((k) => k !== "id").map((k) => [k, val(f, k) ?? null])) })) });
    return { ok: true, body, audit };
  }
  const lines = [req.fields.map(csvCell).join(","), ...features.map((f) => req.fields.map((k) => csvCell(val(f, k))).join(","))];
  return { ok: true, body: lines.join("\r\n") + "\r\n", audit };
}
export * from "./categories.js";
export * from "./location-geometry.js";
