import { ALLOWED_LICENCES, checkGeometry, type Geom } from "./index.js";

/**
 * Validation for location geometry create/update (issue #27). Pure; the database enforces the same rules again
 * (migrations 0001 and 0009). Nothing is repaired: a bad geometry is rejected with reasons. Synthetic geography only.
 */
export const GEOMETRY_METHODS = ["digitised", "surveyed", "imported", "reported", "gps_walk"] as const;
export type GeometryMethod = (typeof GEOMETRY_METHODS)[number];
export const ACCEPTED_CRS = /^(EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC::CRS84|OGC:CRS84)$/i;

export interface GeometryProvenance {
  source: string;
  method: GeometryMethod;
  licence?: string;
  /** ISO date (YYYY-MM-DD) the geometry was captured or digitised. Never in the future. */
  capturedOn?: string;
  note?: string;
}

export interface LocationGeometryInput { crs?: unknown; geometry?: unknown; provenance?: unknown }
export type LocationGeometryResult =
  | { ok: true; geometry: { type: "Point" | "MultiLineString" | "MultiPolygon"; coordinates: unknown }; provenance: GeometryProvenance }
  | { ok: false; reasons: string[] };

const SINGLE_TO_MULTI = { LineString: "MultiLineString", Polygon: "MultiPolygon" } as const;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validateProvenance(p: unknown, today = new Date()): { ok: true; value: GeometryProvenance } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!isObj(p)) return { ok: false, reasons: ["provenance is required"] };
  const source = typeof p["source"] === "string" ? p["source"].trim() : "";
  if (!source) reasons.push("provenance.source is required");
  else if (source.length > 200) reasons.push("provenance.source is longer than 200 characters");
  const method = p["method"];
  if (!(GEOMETRY_METHODS as readonly unknown[]).includes(method)) reasons.push(`provenance.method must be one of ${GEOMETRY_METHODS.join(", ")}`);
  if (p["licence"] !== undefined && !(ALLOWED_LICENCES as readonly unknown[]).includes(p["licence"])) reasons.push("provenance.licence is not on the approved list");
  if (method === "imported" && p["licence"] === undefined) reasons.push("an imported geometry needs a provenance.licence");
  if (p["capturedOn"] !== undefined) {
    const d = typeof p["capturedOn"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p["capturedOn"]) ? new Date(`${p["capturedOn"]}T00:00:00Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== p["capturedOn"]) reasons.push("provenance.capturedOn must be a real YYYY-MM-DD date");
    else if (d.getTime() > today.getTime()) reasons.push("provenance.capturedOn is in the future");
  }
  if (p["note"] !== undefined && (typeof p["note"] !== "string" || p["note"].length > 500)) reasons.push("provenance.note must be text up to 500 characters");
  if (reasons.length) return { ok: false, reasons };
  const out: GeometryProvenance = { source, method: method as GeometryMethod };
  if (p["licence"] !== undefined) out.licence = p["licence"] as string;
  if (p["capturedOn"] !== undefined) out.capturedOn = p["capturedOn"] as string;
  if (typeof p["note"] === "string") out.note = p["note"];
  return { ok: true, value: out };
}

/** The CRS must be declared (a missing label is a mislabel waiting to happen) and be WGS 84. */
export function validateLocationGeometry(input: LocationGeometryInput, today = new Date()): LocationGeometryResult {
  const reasons: string[] = [];
  if (typeof input.crs !== "string" || input.crs.trim() === "") reasons.push("crs is required (declare EPSG:4326)");
  else if (!ACCEPTED_CRS.test(input.crs.trim())) reasons.push(`crs "${input.crs.slice(0, 60)}" is not WGS 84 (EPSG:4326); reproject before submitting`);

  const prov = validateProvenance(input.provenance, today);
  if (!prov.ok) reasons.push(...prov.reasons);

  let geometry: Geom | null = null;
  const g = input.geometry;
  if (!isObj(g) || typeof g["type"] !== "string" || !("coordinates" in g)) reasons.push("geometry must be a GeoJSON geometry object");
  else {
    const type = g["type"] as string;
    if (!["Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(type)) reasons.push(`geometry type ${type.slice(0, 40)} is not allowed (use Point, route or area)`);
    else {
      const sub: string[] = [];
      checkGeometry({ type, coordinates: g["coordinates"] }, sub);
      reasons.push(...sub);
      geometry = { type, coordinates: g["coordinates"] };
    }
  }
  if (reasons.length || !geometry || !prov.ok) return { ok: false, reasons };
  const multi = (SINGLE_TO_MULTI as Record<string, string>)[geometry.type];
  if (multi) geometry = { type: multi, coordinates: [geometry.coordinates] };
  return { ok: true, geometry: geometry as never, provenance: prov.value };
}

export interface GeometryRecord { id: string; revision: number; geometry: unknown; provenance: GeometryProvenance | null }
export type ChangePlan =
  | { kind: "stale"; currentRevision: number }
  | { kind: "unchanged" }
  | { kind: "change"; nextRevision: number };

/** Optimistic concurrency for versioned changes: the caller states which revision it saw. */
export function planGeometryChange(current: GeometryRecord, expectedRevision: number, next: { geometry: unknown; provenance: GeometryProvenance }): ChangePlan {
  if (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision) return { kind: "stale", currentRevision: current.revision };
  if (JSON.stringify(current.geometry) === JSON.stringify(next.geometry) && JSON.stringify(current.provenance) === JSON.stringify(next.provenance)) return { kind: "unchanged" };
  return { kind: "change", nextRevision: current.revision + 1 };
}
