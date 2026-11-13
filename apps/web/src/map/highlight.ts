import type { PublicFeature } from "../api.js";
import { LAKE, MELA, MILL, ROZA, ROZA_OUTLINE, inside, ngon, type FC, type Pos } from "./basemap.js";

/**
 * What to outline when a place is selected or a tour stops: the footprint the map actually draws, so the highlight always sits on
 * the right thing. Areas: the place's own polygon. Routes: its line. Points: the mapped area it lies in (Sarkhej Roza, the lake, the
 * mill, the fair ground), else the building it stands on, else the nearest building within ~40 m, else a small ground ring.
 */
export interface Footprint { kind: "area" | "route" | "building" | "ring"; rings: Pos[][]; height: number }

// [where, what to outline]: the lake and Sarkhej Roza use their real OpenStreetMap outlines; the mill and fair ground are sketched
const AREAS: [Pos[], Pos[]][] = [[LAKE, LAKE], [ROZA, ROZA_OUTLINE], [ROZA_OUTLINE, ROZA_OUTLINE], [MILL, MILL], [MELA, MELA]];
const M = 111_320;   // metres per degree of latitude
const KX = Math.cos((23 * Math.PI) / 180);
const metres = (a: Pos, b: Pos) => Math.hypot((a[0] - b[0]) * M * KX, (a[1] - b[1]) * M);
const centroid = (r: Pos[]): Pos => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
const close = (r: Pos[]): Pos[] => (r.length && (r[0]![0] !== r[r.length - 1]![0] || r[0]![1] !== r[r.length - 1]![1]) ? [...r, r[0]!] : r);

export function footprintAt(p: Pos, buildings: FC | null): Footprint {
  const area = AREAS.find(([where]) => inside(p, where));
  if (area) return { kind: "area", rings: [close(area[1])], height: 0 };
  let best: { ring: Pos[]; h: number; d: number } | null = null;
  for (const f of buildings?.features ?? []) {
    if (f.geometry.type !== "Polygon") continue;
    const ring = f.geometry.coordinates[0]!;
    const h = Number(f.properties.h) || 6;
    if (inside(p, ring)) return { kind: "building", rings: [ring], height: h };
    const d = metres(p, centroid(ring));
    if (d < 40 && (!best || d < best.d)) best = { ring, h, d };
  }
  if (best) return { kind: "building", rings: [best.ring], height: best.h };
  return { kind: "ring", rings: [close(ngon(p, 0.00022, 28))], height: 0 };
}

export function footprintOf(f: PublicFeature, buildings: FC | null): Footprint | null {
  const g = f.geometry as { type: string; coordinates: unknown };
  if (g.type === "Polygon") return { kind: "area", rings: [close((g.coordinates as Pos[][])[0]!)], height: 0 };
  if (g.type === "MultiPolygon") return { kind: "area", rings: (g.coordinates as Pos[][][]).map((p) => close(p[0]!)), height: 0 };
  if (g.type === "LineString") return { kind: "route", rings: [g.coordinates as Pos[]], height: 0 };
  if (g.type === "MultiLineString") return { kind: "route", rings: g.coordinates as Pos[][], height: 0 };
  if (g.type === "Point") return footprintAt(g.coordinates as Pos, buildings);
  return null;
}

/** GeoJSON for the highlight layers: outline lines for every footprint, plus the lit building (if any) for the 3D layer. */
export function footprintData(fp: Footprint | null, color: string): { lines: FC; solid: FC } {
  const empty: FC = { type: "FeatureCollection", features: [] };
  if (!fp) return { lines: empty, solid: empty };
  return {
    lines: { type: "FeatureCollection", features: fp.rings.map((r) => ({ type: "Feature", properties: { c: color, kind: fp.kind }, geometry: { type: "LineString", coordinates: r } })) },
    solid: fp.kind === "building" || fp.kind === "area"
      ? { type: "FeatureCollection", features: fp.rings.map((r) => ({ type: "Feature", properties: { c: color, h: fp.height, kind: fp.kind }, geometry: { type: "Polygon", coordinates: [r] } })) }
      : empty,
  };
}
