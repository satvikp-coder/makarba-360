import { findForbiddenField } from "@makarba/contracts";
import { ALLOWED_LICENCES, IMPORT_LIMITS, checkGeometry, type Geom, type FeatureReport, type Position } from "./index.js";

/**
 * Validated road corridor import and verification (issue #28).
 * Staged OSM extracts carry IDs, version, licence and extract date.
 * Enforces negative contracts:
 * - Restricted imagery tracing blocked.
 * - Unverified or placeholder road names blocked.
 * - Non-corridor geometries (points, polygons) blocked.
 */

export interface RoadImportMeta {
  source: string;
  licence: string;
  extractDate: string; // ISO date YYYY-MM-DD
  bounds?: readonly [west: number, south: number, east: number, north: number];
}

export interface RoadImportReport {
  verdict: "accepted" | "rejected";
  fileReasons: string[];
  features: FeatureReport[];
  accepted: { type: "Feature"; geometry: Geom; properties: Record<string, unknown> }[];
  counts: { total: number; accepted: number; rejected: number; outsideBounds: number };
}

export const ROAD_PROPERTY_ALLOWLIST = [
  "name",
  "name_en",
  "name_gu",
  "name_hi",
  "highway",
  "surface",
  "osm_id",
  "osm_version",
  "category",
  "slug",
  "corridor_id",
] as const;

const UNVERIFIED_NAME_PATTERN = /^(unnamed(\s+road|\s+street)?|unknown(\s+road)?|road|street|unverified|n\/a)$/i;
const RESTRICTED_IMAGERY_PATTERN = /(imagery_tracing|satellite_tracing|aerial_tracing|restricted_imagery|unauthorized_aerial|commercial_satellite)/i;

function isIsoDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(d);
  return !Number.isNaN(parsed.getTime());
}

function touchesBounds(g: Geom, b: readonly [number, number, number, number]): boolean {
  let hit = false;
  const isPos = (p: unknown): p is Position => Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number";
  const walk = (c: unknown) => {
    if (isPos(c)) {
      if (c[0]! >= b[0] && c[0]! <= b[2] && c[1]! >= b[1] && c[1]! <= b[3]) hit = true;
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  walk(g.coordinates);
  return hit;
}

export function validateRoadCorridors(text: string, meta: RoadImportMeta): RoadImportReport {
  const fileReasons: string[] = [];

  if (!meta.source || !meta.source.trim()) {
    fileReasons.push("source is required");
  }
  if (!(ALLOWED_LICENCES as readonly string[]).includes(meta.licence)) {
    fileReasons.push(`licence "${meta.licence}" is not on the approved list (${ALLOWED_LICENCES.join(", ")})`);
  }
  if (!meta.extractDate || !isIsoDate(meta.extractDate)) {
    fileReasons.push("extractDate must be a valid ISO date (YYYY-MM-DD)");
  }
  if (RESTRICTED_IMAGERY_PATTERN.test(meta.source)) {
    fileReasons.push("restricted imagery tracing blocked: tracing commercial or unapproved satellite/aerial imagery is prohibited");
  }
  if (new TextEncoder().encode(text).length > IMPORT_LIMITS.maxBytes) {
    fileReasons.push(`file is larger than ${IMPORT_LIMITS.maxBytes} bytes`);
  }

  if (fileReasons.length) {
    return {
      verdict: "rejected",
      fileReasons,
      features: [],
      accepted: [],
      counts: { total: 0, accepted: 0, rejected: 0, outsideBounds: 0 },
    };
  }

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return {
      verdict: "rejected",
      fileReasons: ["file is not valid JSON"],
      features: [],
      accepted: [],
      counts: { total: 0, accepted: 0, rejected: 0, outsideBounds: 0 },
    };
  }

  const d = doc as { type?: unknown; features?: unknown; crs?: { properties?: { name?: unknown } } };
  if (!d || typeof d !== "object" || d.type !== "FeatureCollection" || !Array.isArray(d.features)) {
    return {
      verdict: "rejected",
      fileReasons: ["expected a GeoJSON FeatureCollection"],
      features: [],
      accepted: [],
      counts: { total: 0, accepted: 0, rejected: 0, outsideBounds: 0 },
    };
  }

  if (d.crs !== undefined) {
    const name = String(d.crs?.properties?.name ?? "");
    if (!/(CRS84|EPSG::?4326)$/i.test(name)) {
      return {
        verdict: "rejected",
        fileReasons: [`coordinate system "${name || "unknown"}" is not WGS 84 (EPSG:4326); reproject before importing`],
        features: [],
        accepted: [],
        counts: { total: d.features.length, accepted: 0, rejected: d.features.length, outsideBounds: 0 },
      };
    }
  }

  if (d.features.length === 0) {
    return {
      verdict: "rejected",
      fileReasons: ["file contains no features"],
      features: [],
      accepted: [],
      counts: { total: 0, accepted: 0, rejected: 0, outsideBounds: 0 },
    };
  }

  if (d.features.length > IMPORT_LIMITS.maxFeatures) {
    return {
      verdict: "rejected",
      fileReasons: [`more than ${IMPORT_LIMITS.maxFeatures} features; split the file`],
      features: [],
      accepted: [],
      counts: { total: d.features.length, accepted: 0, rejected: d.features.length, outsideBounds: 0 },
    };
  }

  let vertices = 0;
  let outside = 0;
  const features: FeatureReport[] = [];
  const accepted: RoadImportReport["accepted"] = [];

  d.features.forEach((raw, index) => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const dropped: string[] = [];

    const f = raw as { type?: unknown; geometry?: Geom | null; properties?: Record<string, unknown> | null };
    if (!f || f.type !== "Feature") {
      reasons.push("not a Feature");
    } else if (!f.geometry) {
      reasons.push("no geometry");
    } else {
      // Geometry type restriction: Road corridors must be LineString or MultiLineString
      if (f.geometry.type !== "LineString" && f.geometry.type !== "MultiLineString") {
        reasons.push(`geometry type ${String(f.geometry.type)} is not a valid road corridor; road corridors must be LineString or MultiLineString`);
      } else {
        const n = checkGeometry(f.geometry, reasons);
        vertices += n;
        if (vertices > IMPORT_LIMITS.maxVertices) {
          reasons.push(`file exceeds ${IMPORT_LIMITS.maxVertices} vertices in total`);
        }
      }

      const props = f.properties ?? {};
      const leak = findForbiddenField(props);
      if (leak) {
        reasons.push(`contains a restricted field (${leak.replace(/^\./, "")})`);
      }

      // Check for restricted imagery tracing in feature properties
      const sourceMethod = String(props["source"] ?? props["method"] ?? props["source_type"] ?? "");
      if (RESTRICTED_IMAGERY_PATTERN.test(sourceMethod) || props["imagery_tracing"] === true) {
        reasons.push("restricted imagery tracing blocked: tracing commercial or unapproved satellite/aerial imagery is prohibited");
      }

      // Name verification: Unverified road names blocked
      const rawName = props["name"];
      if (typeof rawName !== "string" || !rawName.trim()) {
        reasons.push("name is required for road corridors");
      } else if (UNVERIFIED_NAME_PATTERN.test(rawName.trim()) || props["verified_name"] === false || props["name_status"] === "unverified") {
        reasons.push("unverified road names blocked: road must have an established, verified name");
      }

      for (const k of Object.keys(props)) {
        if (!(ROAD_PROPERTY_ALLOWLIST as readonly string[]).includes(k as (typeof ROAD_PROPERTY_ALLOWLIST)[number])) {
          dropped.push(k);
        }
      }

      if (!reasons.length && meta.bounds && !touchesBounds(f.geometry, meta.bounds)) {
        warnings.push("outside the study bounds; needs lead review, not moved or clipped");
        outside++;
      }
    }

    const ok = reasons.length === 0;
    features.push({ index, status: ok ? "accepted" : "rejected", reasons, warnings, droppedProperties: dropped });

    if (ok) {
      const props = f.properties ?? {};
      const filteredProps: Record<string, unknown> = {};
      for (const k of ROAD_PROPERTY_ALLOWLIST) {
        if (k in props) filteredProps[k] = props[k];
      }
      filteredProps["source"] = meta.source.trim();
      filteredProps["licence"] = meta.licence;
      filteredProps["extract_date"] = meta.extractDate;

      accepted.push({
        type: "Feature",
        geometry: f.geometry as Geom,
        properties: filteredProps,
      });
    }
  });

  const nAcc = accepted.length;
  const verdict = nAcc === features.length ? "accepted" : "rejected";

  return {
    verdict,
    fileReasons: [],
    features,
    accepted: verdict === "accepted" ? accepted : [],
    counts: {
      total: features.length,
      accepted: nAcc,
      rejected: features.length - nAcc,
      outsideBounds: outside,
    },
  };
}
