import { ARTERIAL, FACTORY_ROAD, HIGHWAY, LOCAL, type FC, type Pos } from "./basemap.js";

/**
 * Moving traffic for the offline 3D map: small extruded vehicles driving along the sketch roads, on the LEFT as in India, with
 * per-kind sizes and speeds, plus a headlight point per vehicle for dusk and night. Pure functions (no map, no DOM) so they can be
 * tested; MapView feeds the output into two GeoJSON sources at ~25 fps.
 */
const M_PER_DEG = 111_320;
const KX = Math.cos((23 * Math.PI) / 180);

export type RoadKind = "highway" | "arterial" | "local";
export type VehicleKind = "car" | "auto" | "bike" | "bus" | "truck";
interface Path { pts: [number, number][]; cum: number[]; len: number; kind: RoadKind }
export interface Vehicle { path: number; s: number; v: number; kind: VehicleKind; color: string; lane: number }

/** length, width, height in metres */
export const DIMS: Record<VehicleKind, [number, number, number]> = { car: [4.4, 1.8, 1.5], auto: [2.8, 1.4, 1.8], bike: [2, 0.7, 1.3], bus: [12, 2.6, 3.2], truck: [9, 2.5, 3.4] };
const BASE_SPEED: Record<RoadKind, number> = { highway: 14, arterial: 9, local: 5 };
const KIND_SPEED: Record<VehicleKind, number> = { car: 1, auto: 0.85, bike: 1, bus: 0.8, truck: 0.75 };
const CAR_COLOURS = ["#f4f4f2", "#c9ced3", "#7f8790", "#2c3138", "#a3352c", "#2f5d8a", "#d9c7a0"];
const KIND_COLOUR: Partial<Record<VehicleKind, string>> = { auto: "#e8c82c", bus: "#c8402e", truck: "#e07b2a" };

// metres in a local plane (x east, y north)
const toM = ([lon, lat]: Pos): [number, number] => [lon * M_PER_DEG * KX, lat * M_PER_DEG];
const toDeg = ([x, y]: [number, number]): Pos => [x / (M_PER_DEG * KX), y / M_PER_DEG];

function path(pts: Pos[], kind: RoadKind): Path {
  const m = pts.map(toM);
  const cum = [0];
  for (let i = 1; i < m.length; i++) cum.push(cum[i - 1]! + Math.hypot(m[i]![0] - m[i - 1]![0], m[i]![1] - m[i - 1]![1]));
  return { pts: m, cum, len: cum[cum.length - 1]!, kind };
}

/** Both directions of every road a vehicle may use. */
export const PATHS: Path[] = [
  [HIGHWAY, "highway"], [ARTERIAL, "arterial"], [FACTORY_ROAD, "arterial"], ...LOCAL.slice(0, 8).map((l) => [l, "local"] as const),
].flatMap(([pts, kind]) => [path(pts as Pos[], kind as RoadKind), path([...(pts as Pos[])].reverse(), kind as RoadKind)]);

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/** n vehicles spread over the network: half on the highway, a quarter on arterials, the rest on local streets. */
export function makeVehicles(n: number, seed = 11): Vehicle[] {
  const r = rng(seed);
  const byKind = (k: RoadKind) => PATHS.map((p, i) => [p, i] as const).filter(([p]) => p.kind === k).map(([, i]) => i);
  const pools = { highway: byKind("highway"), arterial: byKind("arterial"), local: byKind("local") };
  return Array.from({ length: n }, () => {
    const x = r();
    const road: RoadKind = x < 0.5 ? "highway" : x < 0.78 ? "arterial" : "local";
    const pool = pools[road];
    const pi = pool[Math.floor(r() * pool.length)]!;
    const k = r();
    const kind: VehicleKind = road === "local" ? (k < 0.45 ? "bike" : k < 0.75 ? "auto" : "car")
      : k < 0.42 ? "car" : k < 0.62 ? "auto" : k < 0.8 ? "bike" : k < 0.9 ? "bus" : "truck";
    return { path: pi, s: r() * PATHS[pi]!.len, v: BASE_SPEED[road] * KIND_SPEED[kind] * (0.8 + r() * 0.4), kind,
      color: KIND_COLOUR[kind] ?? CAR_COLOURS[Math.floor(r() * CAR_COLOURS.length)]!, lane: road === "highway" ? (kind === "bus" || kind === "truck" ? 0 : Math.floor(r() * 2)) : 0 };
  });
}

/** Advance every vehicle by dt seconds; congestion > 1 slows everyone down. */
export function step(vs: Vehicle[], dt: number, congestion = 1) {
  const slow = 1 / Math.sqrt(Math.max(0.5, congestion));
  for (const v of vs) { const p = PATHS[v.path]!; v.s = (v.s + v.v * dt * slow) % p.len; }
}

function at(p: Path, s: number): { x: number; y: number; dx: number; dy: number } {
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i]! < s) i++;
  const a = p.pts[i - 1]!, b = p.pts[i]!, seg = p.cum[i]! - p.cum[i - 1]! || 1, t = (s - p.cum[i - 1]!) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dy: (b[1] - a[1]) / seg };
}

/** Each vehicle is a few extruded parts: [length share, width share, offset along length (share), base m, top m, colour or "body"]. */
type Part = [number, number, number, number, number, string];
const GLASS = "#25313a";
const PARTS: Record<VehicleKind, Part[]> = {
  car: [[1, 1, 0, 0.25, 0.95, "body"], [0.55, 0.86, -0.05, 0.95, 1.45, GLASS]],
  auto: [[1, 1, 0, 0.25, 0.95, "#3c9a4a"], [0.74, 0.96, -0.08, 0.95, 1.8, "#f2cf2e"]],          // Ahmedabad CNG auto: green body, yellow canopy
  bike: [[1, 0.9, 0, 0.3, 0.9, "body"], [0.3, 0.8, -0.1, 0.9, 1.65, "#4a3b2e"]],                // the rider
  bus: [[1, 1, 0, 0.3, 1.2, "body"], [0.97, 1, 0, 1.2, 2.4, GLASS], [0.98, 1, 0, 2.4, 3.1, "body"]],
  truck: [[0.27, 1, 0.36, 0.3, 2.6, "body"], [0.68, 1.04, -0.15, 0.6, 3.4, "#d9d4c8"]],
};

const LANE: Record<RoadKind, (lane: number) => number> = { highway: (l) => 2.2 + l * 3.3, arterial: () => 1.9, local: () => 1.2 };

/** GeoJSON for the vehicle bodies (extruded) and their headlights. */
export function toFeatures(vs: Vehicle[]): { bodies: FC; lights: FC } {
  const bodies: FC["features"] = [], lights: FC["features"] = [];
  for (const v of vs) {
    const p = PATHS[v.path]!, q = at(p, v.s);
    const [L, W] = DIMS[v.kind];
    const off = LANE[p.kind](v.lane);
    // keep left: shift to the left of the direction of travel
    const nx = -q.dy, ny = q.dx;
    const cx = q.x + nx * off, cy = q.y + ny * off;
    for (const [ls, ws, along, b, h, col] of PARTS[v.kind]) {
      const px = cx + q.dx * along * L, py = cy + q.dy * along * L;
      const fx = q.dx * L * ls / 2, fy = q.dy * L * ls / 2, sx = nx * W * ws / 2, sy = ny * W * ws / 2;
      const ring: Pos[] = [[px + fx + sx, py + fy + sy], [px + fx - sx, py + fy - sy], [px - fx - sx, py - fy - sy], [px - fx + sx, py - fy + sy]].map((m) => toDeg(m as [number, number]));
      bodies.push({ type: "Feature", properties: { b, h, c: col === "body" ? v.color : col, k: v.kind }, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] } });
    }
    lights.push({ type: "Feature", properties: { k: v.kind }, geometry: { type: "Point", coordinates: toDeg([cx + q.dx * (L / 2 + 1.5), cy + q.dy * (L / 2 + 1.5)]) } });
  }
  return { bodies: { type: "FeatureCollection", features: bodies }, lights: { type: "FeatureCollection", features: lights } };
}
