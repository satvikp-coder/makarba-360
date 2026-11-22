import { findForbiddenField } from "@makarba/contracts";
import { ALLOWED_LICENCES, IMPORT_LIMITS, checkGeometry, type Geom } from "./index.js";
import { SUPPORTED_CRS, reprojectCoordinates, type Crs } from "./projection.js";

/**
 * Historical and thematic layer import for the Past tab. A layer is staged only with dated provenance (source, licence, as-of year,
 * access date, method, confidence, limitations), a declared coordinate system that is reprojected to WGS 84, geometry that passes
 * the repository's geometry checks, and an extent inside the study area. Nothing is repaired or invented; a layer that fails is
 * rejected with reasons. Pure functions (file access lives in historical-cli.ts).
 */
export const PAST_LAYER_KINDS = ["roads", "landuse", "tp-boundary", "builtup", "water", "green", "heritage-protection"] as const;
export type PastLayerKind = (typeof PAST_LAYER_KINDS)[number];
export const PAST_STATUSES = ["proposed", "sanctioned", "implemented", "observed", "reconstruction"] as const;
export type PastStatus = (typeof PAST_STATUSES)[number];
export const PAST_CONFIDENCE = ["high", "medium", "low"] as const;
/** Study area for Sarkhej-Makarba: west, south, east, north (WGS 84). A layer must lie inside it; wider sources are clipped upstream, not here. */
export const STUDY_BOUNDS: readonly [number, number, number, number] = [72.44, 22.93, 72.58, 23.05];
/** Property names kept on import; all others are dropped and reported. */
export const PAST_PROPERTY_ALLOWLIST = ["name", "class", "road_class", "scheme_id", "osm_id", "note"] as const;

const LINE_KINDS: readonly PastLayerKind[] = ["roads"];
const isLine = (t: string) => t === "LineString" || t === "MultiLineString";
const isArea = (t: string) => t === "Polygon" || t === "MultiPolygon";

export interface PastLayerMeta {
  id: string; kind: PastLayerKind; title: string; status: PastStatus;
  source: { title: string; url: string }; licence: string; crs: Crs;
  asOf: { year: number; precision: "exact" | "year" | "circa" };
  accessed: string; method: string; confidence: "high" | "medium" | "low"; limitations: string;
  coverage: readonly [number, number, number, number];
  /** Required for scanned maps or imagery overlays that were georeferenced by the project. */
  georeferencing?: { method: string; controlPoints: number; rmseMetres: number };
  /** tp-boundary layers must say which scheme they describe. */
  schemeId?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function validateLayerMeta(m: Partial<PastLayerMeta> | null | undefined, now = new Date()): string[] {
  const r: string[] = [];
  if (!m || typeof m !== "object") return ["metadata is missing"];
  if (!m.id || !ID.test(m.id)) r.push("id must be lowercase letters, digits and hyphens (2-63 characters)");
  if (!PAST_LAYER_KINDS.includes(m.kind as PastLayerKind)) r.push(`kind must be one of ${PAST_LAYER_KINDS.join(", ")}`);
  if (!m.title?.trim()) r.push("title is required");
  if (!PAST_STATUSES.includes(m.status as PastStatus)) r.push(`status must be one of ${PAST_STATUSES.join(", ")} (proposed, sanctioned, implemented and observed are different things)`);
  if (!m.source?.title?.trim() || !/^https:\/\//.test(m.source?.url ?? "")) r.push("source needs a title and an https URL");
  if (!(ALLOWED_LICENCES as readonly string[]).includes(m.licence ?? "")) r.push(`licence "${m.licence ?? ""}" is not on the approved list (${ALLOWED_LICENCES.join(", ")})`);
  if (!SUPPORTED_CRS.includes(m.crs as Crs)) r.push(`crs must be one of ${SUPPORTED_CRS.join(", ")}`);
  const y = m.asOf?.year;
  if (typeof y !== "number" || !Number.isInteger(y) || y < 1000 || y > now.getFullYear()) r.push("asOf.year must be a whole year between 1000 and this year");
  if (!["exact", "year", "circa"].includes(m.asOf?.precision as string)) r.push("asOf.precision must be exact, year or circa");
  if (!ISO.test(m.accessed ?? "")) r.push("accessed must be an ISO date (YYYY-MM-DD)");
  else if (new Date(m.accessed!) > now) r.push("accessed is in the future");
  if (!m.method?.trim()) r.push("method is required (how the data were produced or digitised)");
  if (!PAST_CONFIDENCE.includes(m.confidence as "high")) r.push("confidence must be high, medium or low");
  if (!m.limitations?.trim()) r.push("limitations are required");
  const c = m.coverage;
  if (!c || c.length !== 4 || !c.every(Number.isFinite) || c[0] >= c[2] || c[1] >= c[3]) r.push("coverage must be [west, south, east, north] in WGS 84 with west < east and south < north");
  else if (c[0] < STUDY_BOUNDS[0] || c[1] < STUDY_BOUNDS[1] || c[2] > STUDY_BOUNDS[2] || c[3] > STUDY_BOUNDS[3]) r.push(`coverage is outside the study area ${STUDY_BOUNDS.join(", ")}; clip the source first`);
  if (m.kind === "tp-boundary" && !m.schemeId?.trim()) r.push("a tp-boundary layer needs schemeId");
  if (m.status === "reconstruction" && !/reconstruct/i.test(`${m.method ?? ""} ${m.limitations ?? ""}`)) r.push("a reconstruction must say so in method or limitations");
  const g = m.georeferencing;
  if (g !== undefined && (!g.method?.trim() || !Number.isInteger(g.controlPoints) || g.controlPoints < 4 || !Number.isFinite(g.rmseMetres) || g.rmseMetres < 0)) r.push("georeferencing needs a method, at least 4 control points and an RMSE in metres");
  if (g !== undefined && Number.isFinite(g.rmseMetres) && g.rmseMetres > 25) r.push(`georeferencing RMSE ${g.rmseMetres} m is above the 25 m limit for a defensible overlay`);
  return r;
}

export interface PastLayerReport {
  verdict: "accepted" | "rejected"; reasons: string[]; warnings: string[];
  counts: { features: number; vertices: number; droppedProperties: number; duplicates: number };
  reprojected: boolean;
  /** Normalised WGS 84 FeatureCollection, present only when accepted. */
  layer?: { type: "FeatureCollection"; features: { type: "Feature"; id?: string | number; geometry: Geom; properties: Record<string, unknown> }[] };
}

const reject = (reasons: string[], warnings: string[] = [], counts = { features: 0, vertices: 0, droppedProperties: 0, duplicates: 0 }, reprojected = false): PastLayerReport => ({ verdict: "rejected", reasons, warnings, counts, reprojected });

function bboxOf(g: Geom): [number, number, number, number] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown) => { if (Array.isArray(c) && typeof c[0] === "number") { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1] as number); n = Math.max(n, c[1] as number); } else if (Array.isArray(c)) c.forEach(walk); };
  walk(g.coordinates);
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

export function validatePastLayer(text: string, meta: PastLayerMeta, now = new Date()): PastLayerReport {
  const reasons = validateLayerMeta(meta, now);
  if (new TextEncoder().encode(text).length > IMPORT_LIMITS.maxBytes) reasons.push(`file is larger than ${IMPORT_LIMITS.maxBytes} bytes`);
  if (reasons.length) return reject(reasons);
  let doc: { type?: unknown; features?: unknown; crs?: { properties?: { name?: unknown } } };
  try { doc = JSON.parse(text); } catch { return reject(["file is not valid JSON"]); }
  if (!doc || doc.type !== "FeatureCollection" || !Array.isArray(doc.features)) return reject(["expected a GeoJSON FeatureCollection"]);
  if (doc.crs !== undefined) {
    const named = String(doc.crs?.properties?.name ?? "");
    const code = /(CRS84|EPSG::?4326)$/i.test(named) ? "EPSG:4326" : (/EPSG::?(\d+)$/i.exec(named)?.[1] ? `EPSG:${/EPSG::?(\d+)$/i.exec(named)![1]}` : "");
    if (code !== meta.crs) return reject([`the file declares coordinate system "${named || "unknown"}" but the metadata says ${meta.crs}; they must agree`]);
  }
  if (doc.features.length === 0) return reject(["file contains no features"]);
  if (doc.features.length > IMPORT_LIMITS.maxFeatures) return reject([`more than ${IMPORT_LIMITS.maxFeatures} features; split the file`]);

  const out: NonNullable<PastLayerReport["layer"]>["features"] = [];
  const warnings: string[] = [];
  const fail: string[] = [];
  let vertices = 0, dropped = 0, duplicates = 0, reprojected = false;
  const seenIds = new Set<string>(), seenGeom = new Set<string>(), schemeGeom = new Map<string, string>();
  const want = LINE_KINDS.includes(meta.kind) ? "line" : "area";

  doc.features.forEach((raw, i) => {
    const at = `feature ${i + 1}`;
    const f = raw as { type?: unknown; id?: string | number; geometry?: Geom | null; properties?: Record<string, unknown> | null };
    if (!f || f.type !== "Feature" || !f.geometry) { fail.push(`${at}: not a Feature with geometry`); return; }
    const leak = findForbiddenField(f.properties ?? {});
    if (leak) { fail.push(`${at}: contains a restricted field (${leak.replace(/^\./, "")})`); return; }
    let g: Geom;
    try {
      g = { type: f.geometry.type, coordinates: reprojectCoordinates(meta.crs, f.geometry.coordinates) };
      if (meta.crs !== "EPSG:4326") reprojected = true;
    } catch { fail.push(`${at}: coordinates are not numeric`); return; }
    const reasonsF: string[] = [];
    vertices += checkGeometry(g, reasonsF);
    if (vertices > IMPORT_LIMITS.maxVertices) reasonsF.push(`file exceeds ${IMPORT_LIMITS.maxVertices} vertices in total`);
    if (want === "line" && !isLine(g.type)) reasonsF.push(`a ${meta.kind} layer needs line geometry, found ${g.type}`);
    if (want === "area" && !isArea(g.type)) reasonsF.push(`a ${meta.kind} layer needs polygon geometry, found ${g.type}`);
    const b = bboxOf(g);
    if (b && !reasonsF.length) {
      if (b[0] < STUDY_BOUNDS[0] || b[1] < STUDY_BOUNDS[1] || b[2] > STUDY_BOUNDS[2] || b[3] > STUDY_BOUNDS[3]) reasonsF.push("geometry extends outside the study area; clip it upstream");
      else if (b[0] < meta.coverage[0] || b[1] < meta.coverage[1] || b[2] > meta.coverage[2] || b[3] > meta.coverage[3]) reasonsF.push("geometry extends outside the declared coverage");
    }
    if (reasonsF.length) { reasonsF.forEach((x) => fail.push(`${at}: ${x}`)); return; }

    const props = f.properties ?? {};
    const kept: Record<string, unknown> = {};
    for (const k of Object.keys(props)) { if ((PAST_PROPERTY_ALLOWLIST as readonly string[]).includes(k)) kept[k] = props[k]; else dropped++; }
    if (meta.kind === "tp-boundary") kept["scheme_id"] = meta.schemeId;
    if (meta.kind === "landuse" && (typeof kept["class"] !== "string" || !String(kept["class"]).trim())) { fail.push(`${at}: land use features need a class`); return; }
    const key = JSON.stringify(g.coordinates);
    if (f.id !== undefined && seenIds.has(String(f.id))) { fail.push(`${at}: duplicate id ${String(f.id)}`); return; }
    if (seenGeom.has(key)) { duplicates++; warnings.push(`${at}: identical geometry to an earlier feature, dropped`); return; }
    if (meta.kind === "tp-boundary") {
      const prev = schemeGeom.get(String(meta.schemeId));
      if (prev !== undefined && prev !== key) { fail.push(`${at}: conflicting boundary for scheme ${meta.schemeId} (a layer holds one boundary per scheme)`); return; }
      schemeGeom.set(String(meta.schemeId), key);
    }
    if (f.id !== undefined) seenIds.add(String(f.id));
    seenGeom.add(key);
    out.push({ type: "Feature", ...(f.id !== undefined ? { id: f.id } : {}), geometry: g, properties: kept });
  });

  const counts = { features: out.length, vertices, droppedProperties: dropped, duplicates };
  if (fail.length) return reject(fail, warnings, counts, reprojected);
  if (dropped) warnings.push(`${dropped} propert${dropped === 1 ? "y was" : "ies were"} dropped (only ${PAST_PROPERTY_ALLOWLIST.join(", ")} are kept)`);
  if (meta.confidence === "high" && meta.georeferencing && meta.georeferencing.rmseMetres > 10) warnings.push("confidence is high but the georeferencing RMSE is above 10 m");
  return { verdict: "accepted", reasons: [], warnings, counts, reprojected, layer: { type: "FeatureCollection", features: out } };
}

// ------------------------------------------------------------------ registry

export interface RegistrySlot { id: string; kind: PastLayerKind; title: string; status: "unavailable"; evidenceRequired: string; acceptableSources: string[] }
export interface RegistryLayer { id: string; kind: PastLayerKind; title: string; status: "available"; file: string; sha256: string; meta: PastLayerMeta; counts: PastLayerReport["counts"] }
export interface MeasurementSeries {
  id: string; title: string; unit: string; method: string; limits: string;
  source: { title: string; url: string; tier: "primary" | "secondary" | "tertiary"; accessed: string };
  points: { label: string; year: number; value: number; approx: boolean }[];
  /** Must describe the same area and definition in every year, otherwise the points cannot be compared. */
  sameAreaAndDefinition: boolean;
}
export interface PastRegistry { version: 1; studyBounds: readonly number[]; slots: RegistrySlot[]; layers: RegistryLayer[]; measurements: MeasurementSeries[] }

export function validateMeasurementSeries(s: MeasurementSeries): string[] {
  const r: string[] = [];
  if (!s.id || !ID.test(s.id)) r.push("measurement id is invalid");
  if (!s.unit?.trim()) r.push(`${s.id}: unit is required`);
  if (!s.method?.trim() || !s.limits?.trim()) r.push(`${s.id}: method and limits are required`);
  if (!/^https:\/\//.test(s.source?.url ?? "") || !ISO.test(s.source?.accessed ?? "")) r.push(`${s.id}: source needs an https URL and an access date`);
  if (s.sameAreaAndDefinition !== true) r.push(`${s.id}: the points must be confirmed to cover the same area with the same definition`);
  const pts = s.points ?? [];
  if (pts.some((p) => !Number.isFinite(p.value) || !Number.isInteger(p.year))) r.push(`${s.id}: every point needs a finite value and a whole year`);
  if (new Set(pts.map((p) => p.year)).size !== pts.length) r.push(`${s.id}: two points share a year`);
  return r;
}

/** Checks the registry document itself: slots explain what is missing; available layers carry full metadata and a hash. */
export function validateRegistry(reg: PastRegistry): string[] {
  const r: string[] = [];
  if (reg.version !== 1) r.push("registry version must be 1");
  const ids = new Set<string>();
  for (const s of reg.slots) {
    if (ids.has(s.id)) r.push(`duplicate id ${s.id}`); ids.add(s.id);
    if (!PAST_LAYER_KINDS.includes(s.kind)) r.push(`${s.id}: unknown kind`);
    if (!s.evidenceRequired?.trim() || !s.acceptableSources?.length) r.push(`${s.id}: an unavailable layer must state the evidence required and acceptable sources`);
  }
  for (const l of reg.layers) {
    if (ids.has(l.id)) r.push(`duplicate id ${l.id}`); ids.add(l.id);
    if (!/^[0-9a-f]{64}$/.test(l.sha256)) r.push(`${l.id}: sha256 is missing`);
    if (!/^geo\/past\/[a-z0-9-]+\.geojson$/.test(l.file)) r.push(`${l.id}: file must be geo/past/<id>.geojson`);
    validateLayerMeta(l.meta).forEach((x) => r.push(`${l.id}: ${x}`));
  }
  const mids = new Set<string>();
  for (const m of reg.measurements) { if (mids.has(m.id)) r.push(`duplicate measurement ${m.id}`); mids.add(m.id); r.push(...validateMeasurementSeries(m)); }
  return r;
}
