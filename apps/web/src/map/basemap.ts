import type * as maplibregl from "maplibre-gl";
import osmJson from "../../../../data/geo/osm-landmarks.json";
import osmRoads from "../../../../data/geo/osm-roads.json";

/**
 * Self-contained, OFFLINE basemap for the Makarba demo map. Everything is authored here as GeoJSON: no tile server, no glyphs, no
 * sprites, no fonts, no network request of any kind. Text labels are HTML (see MapView), so the style needs no glyph endpoint.
 *
 * The geometry is a hand-drawn APPROXIMATION for an illustrative demo, NOT surveyed. Sarkhej Roza's position follows its published
 * coordinates (22°59′32″N 72°30′16″E, Wikipedia "Sarkhej Roza", retrieved 2026-11-10); the lake, highway, canal and street alignments
 * are approximate sketches; building footprints and heights are generated procedurally from dummy attributes.
 */
export type Pos = [number, number];
type Props = Record<string, string | number>;
interface F { type: "Feature"; properties: Props; geometry: { type: "Polygon"; coordinates: Pos[][] } | { type: "LineString"; coordinates: Pos[] } | { type: "Point"; coordinates: Pos } }
export interface FC { type: "FeatureCollection"; features: F[] }

export const MAKARBA_CENTER: Pos = [72.5078, 22.9928];
/** [[west, south], [east, north]] of the demo area. The camera is kept near it. */
export const MAKARBA_BOUNDS: [Pos, Pos] = [[72.49, 22.975], [72.52, 23.005]];
export const BASEMAP_ATTRIBUTION = "Basemap: Makarba 360 sketch map; highway, main road, canal, Sarkhej Roza and lake © OpenStreetMap contributors (ODbL)";

const poly = (ring: Pos[], properties: Props): F => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] } });
const box = (w: number, s: number, e: number, n: number): Pos[] => [[w, s], [e, s], [e, n], [w, n]];
const line = (coordinates: Pos[], properties: Props): F => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates } });

// --- authored features --------------------------------------------------------------------------------------------------------
// The S.G. Highway (NH147), the Sarkhej road (NH8A) and the canal follow OpenStreetMap (data/geo/osm-roads.json, ODbL).
const OSM_ROADS = osmRoads as unknown as Record<"highway" | "arterial" | "canal", { coordinates: Pos[] }>;
export const HIGHWAY: Pos[] = OSM_ROADS.highway.coordinates;
export const CANAL: Pos[] = OSM_ROADS.canal.coordinates;
export const ARTERIAL: Pos[] = OSM_ROADS.arterial.coordinates;
export const FACTORY_ROAD: Pos[] = [[72.5137, 22.9966], [72.5168, 22.9981], [72.5198, 22.9996]];
export const LOCAL: Pos[][] = [
  [[72.5058, 22.9934], [72.5121, 22.9938]],
  [[72.5081, 22.9884], [72.5084, 22.9965]],
  [[72.5103, 22.9884], [72.5106, 22.9968]],
  [[72.5, 22.9878], [72.4995, 22.999]],
  [[72.504, 22.995], [72.5135, 22.9955]],
  [[72.496, 23.0036], [72.5146, 23.0033]],
  [[72.5146, 22.979], [72.52, 22.98]],
  [[72.493, 22.98], [72.5112, 22.981]],
  [[72.495, 22.981], [72.4955, 22.9872]],
  [[72.504, 22.981], [72.5045, 22.9872]],
  [[72.5192, 22.9888], [72.5195, 23.004]],
  [[72.493, 22.994], [72.4995, 22.9945]],
  [[72.5125, 22.9846], [72.52, 22.985]],
];
// Sarkhej Roza and its tank follow OpenStreetMap (data/geo/osm-landmarks.json, © OpenStreetMap contributors, ODbL); the 3D model of
// the complex below is an authored sketch, scaled and placed onto the real mosque and tomb footprint.
const OSM = osmJson as unknown as { features: { properties: { key: string }; geometry: { coordinates: Pos[][] } }[] };
const osmRing = (key: string): Pos[] => OSM.features.find((f) => f.properties.key === key)!.geometry.coordinates[0]!.slice(0, -1);
export const LAKE: Pos[] = osmRing("lake");
/** Real outlines for highlighting: the mosque and tomb buildings, and the whole complex with its tank. */
export const ROZA_OUTLINE: Pos[] = osmRing("mosque");
export const ROZA_COMPLEX: Pos[] = osmRing("complex");
// sketch model coordinates -> real site: scale about the sketch centre, then move onto the mosque's centre
const SKETCH_C: Pos = [72.5045, 22.9923], SITE_C: Pos = [72.50539, 22.99342], SITE_K = 0.6;
const site = (p: Pos): Pos => [SITE_C[0] + (p[0] - SKETCH_C[0]) * SITE_K, SITE_C[1] + (p[1] - SKETCH_C[1]) * SITE_K];
export const ROZA: Pos[] = box(72.5032, 22.9912, 72.5058, 22.9934).map(site);
export const MELA = box(72.506, 22.99, 72.5078, 22.9912);
export const MILL = box(72.515, 22.9905, 72.5185, 22.9935);
const GREENS: Pos[][] = [box(72.5026, 22.9909, 72.5064, 22.9938), box(72.5025, 22.9955, 72.504, 22.9968), box(72.4935, 22.9958, 72.4975, 22.9985)];

export const roads: FC = {
  type: "FeatureCollection",
  features: [
    line(HIGHWAY, { kind: "highway" }),
    line(ARTERIAL, { kind: "arterial" }),
    line(FACTORY_ROAD, { kind: "arterial" }),
    ...LOCAL.map((c) => line(c, { kind: "local" })),
  ],
};
export const water: FC = { type: "FeatureCollection", features: [poly(LAKE, { kind: "lake" })] };
export const canal: FC = { type: "FeatureCollection", features: [line(CANAL, { kind: "canal" })] };
export const greens: FC = { type: "FeatureCollection", features: [...GREENS.map((r) => poly(r, { kind: "green" })), poly(MELA, { kind: "ground" })] };

/** A regular n-gon ring (used for domes, tanks, tree canopies and pillars). Longitude is stretched so circles stay round. */
const KXr = Math.cos((23 * Math.PI) / 180);
export const ngon = (c: Pos, r: number, n = 10, rot = 0): Pos[] =>
  Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [c[0] + (Math.cos(a) * r) / KXr, c[1] + Math.sin(a) * r] as Pos; });
/** A dome as stacked, narrowing tiers on a drum, with a finial: reads as a dome at map zooms without any mesh. */
function dome(c: Pos, r: number, base: number, rise: number, part = "dome"): F[] {
  const tiers = [1, 0.97, 0.9, 0.8, 0.66, 0.48, 0.28];
  const out = tiers.map((k, i) => poly(ngon(c, r * k, 16), { b: base + (rise * i) / tiers.length, h: base + (rise * (i + 1)) / tiers.length, part }));
  out.push(poly(ngon(c, r * 0.08, 6), { b: base + rise, h: base + rise * 1.25, part: "finial" }));
  return out;
}
const along = (a: Pos, b: Pos, step: number): Pos[] => {
  const n = Math.max(1, Math.round(Math.hypot((b[0] - a[0]) * KXr, b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as Pos);
};
const ring = (outer: Pos[], inner: Pos[], properties: Props): F => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [[...outer, outer[0]!], [...inner, inner[0]!].reverse()] } });
const scaleRing = (r: Pos[], k: number): Pos[] => {
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cy = r.reduce((a, p) => a + p[1], 0) / r.length;
  return r.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as Pos);
};

/**
 * Massing of the Roza complex, still a sketch but with its parts legible: courtyard walls with an inner colonnade, the tomb on a plinth
 * with drum and dome, the mosque with a row of small domes, the gateway, and Begada's palace with chhatris at the lake's south-west corner
 * (its position is sourced; its form is not). `part` lets the style tint stone, dome and finial differently.
 */
export const landmark: FC = (() => {
  const f: F[] = [
    poly(box(72.5032, 22.9912, 72.5058, 22.9914), { h: 5, b: 0, part: "wall" }), poly(box(72.5032, 22.9932, 72.5058, 22.9934), { h: 5, b: 0, part: "wall" }),
    poly(box(72.5032, 22.9912, 72.5034, 22.9934), { h: 5, b: 0, part: "wall" }), poly(box(72.5056, 22.9912, 72.5058, 22.9934), { h: 5, b: 0, part: "wall" }),
    // tomb: plinth, hall, parapet, drum, dome
    poly(box(72.50425, 22.99208, 72.50500, 22.99282), { h: 1.6, b: 0, part: "plinth" }),
    poly(box(72.5043, 22.99215, 72.50495, 22.99275), { h: 11, b: 1.6, part: "stone" }),
    poly(box(72.50428, 22.99213, 72.50497, 22.99277), { h: 12, b: 11, part: "parapet" }),
    poly(ngon([72.504625, 22.99245], 0.00019, 16), { h: 14, b: 12, part: "stone" }),
    ...dome([72.504625, 22.99245], 0.00018, 14, 9),
    // corner chhatris on the tomb roof
    ...[[72.50438, 22.99222], [72.50487, 22.99222], [72.50438, 22.99268], [72.50487, 22.99268]].flatMap((c) => [
      poly(ngon(c as Pos, 0.000045, 8), { h: 14, b: 12, part: "stone" }), ...dome(c as Pos, 0.000045, 14, 2.2)]),
    // mosque: prayer hall with a row of small domes and two short minaret stumps
    poly(box(72.5035, 22.9927, 72.5041, 22.99315), { h: 9, b: 0, part: "stone" }),
    ...along([72.50365, 22.99282], [72.50365, 22.99303], 0.00005).flatMap((c) => dome(c, 0.00006, 9, 3.4)),
    ...along([72.50395, 22.99282], [72.50395, 22.99303], 0.00005).flatMap((c) => dome(c, 0.00006, 9, 3.4)),
    poly(ngon([72.50352, 22.99273], 0.00004, 8), { h: 13, b: 0, part: "stone" }), poly(ngon([72.50408, 22.99273], 0.00004, 8), { h: 13, b: 0, part: "stone" }),
    // gateway
    poly(box(72.5036, 22.99155, 72.5041, 22.9919), { h: 8, b: 0, part: "stone" }), ...dome([72.503855, 22.991725], 0.00009, 8, 3),
  ];
  // inner colonnade: square pillars along each courtyard wall
  const pillars = [
    ...along([72.50345, 22.99152], [72.50565, 22.99152], 0.00011), ...along([72.50345, 22.99308], [72.50565, 22.99308], 0.00011),
    ...along([72.50422, 22.99165], [72.50422, 22.99198], 0.00011), ...along([72.50548, 22.99165], [72.50548, 22.99305], 0.00011),
  ];
  for (const c of pillars) f.push(poly(ngon(c, 0.000016, 4, Math.PI / 4), { h: 4.2, b: 0, part: "stone" }));
  // the authored model was drawn at sketch coordinates: move every vertex onto the real site
  for (const x of f) if (x.geometry.type === "Polygon") x.geometry.coordinates = x.geometry.coordinates.map((r) => r.map(site));
  // Begada's palace at the tank's south-west corner, with two chhatris
  const sw: Pos = [Math.min(...LAKE.map((p) => p[0])), Math.min(...LAKE.map((p) => p[1]))];
  f.push(poly(box(sw[0] - 0.0003, sw[1] - 0.0002, sw[0] + 0.0001, sw[1] + 0.0001), { h: 7, b: 0, part: "stone" }));
  f.push(...[[sw[0] - 0.0002, sw[1] - 0.00005], [sw[0], sw[1] - 0.00005]].flatMap((c) => dome(c as Pos, 0.00006, 7, 2.6)));
  // stone ghat steps around the lake
  [[1.1, 1.07, 0.9], [1.07, 1.035, 0.6], [1.035, 1.0, 0.3]].forEach(([o, i, h]) => f.push(ring(scaleRing(LAKE, o!), scaleRing(LAKE, i!), { h: h!, b: 0, part: "ghat" })));
  return { type: "FeatureCollection", features: f };
})();

// --- procedural buildings ---------------------------------------------------------------------------------------------------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const KX = Math.cos((23 * Math.PI) / 180); // degrees of longitude are shorter than latitude here
function segDist(p: Pos, a: Pos, b: Pos): number {
  const ax = a[0] * KX, ay = a[1], bx = b[0] * KX, by = b[1], px = p[0] * KX, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export const lineDist = (p: Pos, l: Pos[]) => l.slice(1).reduce((m, b, i) => Math.min(m, segDist(p, l[i]!, b)), Infinity);
export function inside(p: Pos, ring: Pos[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const canalLatAt = (lon: number) => {
  for (let i = 1; i < CANAL.length; i++) {
    const [x0, y0] = CANAL[i - 1]!, [x1, y1] = CANAL[i]!;
    if (lon <= x1) return y0 + ((lon - x0) / (x1 - x0)) * (y1 - y0);
  }
  return CANAL[CANAL.length - 1]![1];
};

/** Deterministic footprints with a dummy `levels` attribute; height = levels x 3.2 m. Keeps clear of water, roads and open spaces. */
export function generateBuildings(seed = 2026): FC {
  const r = rng(seed);
  const features: F[] = [];
  const blocked = [LAKE, ROZA, MELA, MILL, ...GREENS];
  for (let lat = 22.977; lat < 23.0045; lat += 0.00045) {
    for (let lon = 72.4915; lon < 72.5195; lon += 0.0005) {
      if (r() < 0.33) continue;
      const c: Pos = [lon + (r() - 0.5) * 0.00012, lat + (r() - 0.5) * 0.0001];
      if (blocked.some((ring) => inside(c, ring))) continue;
      if (lineDist(c, HIGHWAY) < 0.00045 || lineDist(c, CANAL) < 0.00034 || lineDist(c, ARTERIAL) < 0.00026 || lineDist(c, FACTORY_ROAD) < 0.00024) continue;
      if (LOCAL.some((l) => lineDist(c, l) < 0.00018)) continue;
      const nearHighway = lineDist(c, HIGHWAY) < 0.0032;
      const village = Math.hypot((c[0] - 72.508) * KX, c[1] - 22.9935) < 0.0038;
      const north = c[1] > canalLatAt(c[0]);
      let levels: number;
      if (village) levels = 1 + Math.floor(r() * 3);
      else if (nearHighway) levels = 4 + Math.floor(r() * (c[1] > 22.996 ? 15 : 9));
      else if (north) levels = 4 + Math.floor(r() * 8);
      else levels = 2 + Math.floor(r() * 4);
      const hw = (village ? 0.00006 : 0.00009) + r() * 0.00007, hh = (village ? 0.00005 : 0.00008) + r() * 0.00006;
      const a = (r() - 0.5) * 0.3, ca = Math.cos(a), sa = Math.sin(a);
      const ring: Pos[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [c[0] + (x! * ca - y! * sa) / KX, c[1] + (x! * sa + y! * ca)] as Pos);
      if (ring.some((p) => blocked.some((b) => inside(p, b)))) continue;   // no corner may reach into water or open space
      // zone and a stable per-plot random value let forecast scenarios restyle the city without changing its layout
      const zone = village ? "village" : nearHighway ? "corridor" : north ? "north" : "south";
      const k = Math.sin(features.length * 12.9898) * 43758.5453;
      features.push(poly(ring, { levels, h: Math.round(levels * 3.2), zone, r: Math.round((k - Math.floor(k)) * 1000) / 1000 }));
    }
  }
  // former mill compound: long sheds and one chimney
  for (let i = 0; i < 4; i++) features.push(poly(box(72.5154 + i * 0.0008, 22.991, 72.5159 + i * 0.0008, 22.993), { levels: 3, h: 10, mill: 1, zone: "mill", r: 1 }));
  features.push(poly(box(72.51815, 22.9927, 72.51827, 22.99282), { levels: 11, h: 35, mill: 1, zone: "mill", r: 1 }));
  return { type: "FeatureCollection", features };
}

/** Rooftop detail for the generated city: stair/lift rooms on taller blocks, black water tanks on low-rise roofs. Same zone/r/h as
 *  the building below, so forecast scenarios can lift them with it. */
export function generateRoofs(b: FC): FC {
  const features: F[] = [];
  for (const f of b.features) {
    const p = f.properties, h = Number(p["h"]), r = Number(p["r"] ?? 0.5);
    if (p["mill"] || f.geometry.type !== "Polygon") continue;
    const ringPts = f.geometry.coordinates[0]!.slice(0, 4);
    const c: Pos = [ringPts.reduce((a, q) => a + q[0], 0) / 4, ringPts.reduce((a, q) => a + q[1], 0) / 4];
    const shared = { h, zone: String(p["zone"]), r };
    // parapet: a low wall around the roof edge (outer ring = footprint, hole = footprint shrunk by ~0.4 m)
    const inner = ringPts.map(([x, y]) => [c[0] + (x - c[0]) * 0.9, c[1] + (y - c[1]) * 0.9] as Pos);
    features.push(ring(ringPts, inner, { ...shared, extra: 1.0, kind: "parapet" }));
    if (h >= 12) {
      const k = 0.32, off: Pos = [(ringPts[1]![0] - c[0]) * 0.35, (ringPts[1]![1] - c[1]) * 0.35];
      features.push(poly(ringPts.map(([x, y]) => [c[0] + off[0] + (x - c[0]) * k, c[1] + off[1] + (y - c[1]) * k] as Pos), { ...shared, extra: 3, kind: "room" }));
    }
    if (r > 0.25) features.push(poly(ngon([c[0] - (ringPts[1]![0] - c[0]) * 0.3, c[1] - (ringPts[1]![1] - c[1]) * 0.3], 0.000014, 8), { ...shared, extra: 1.7, kind: "tank" }));
  }
  return { type: "FeatureCollection", features };
}

/**
 * Floor ledges and balcony slabs: a thin ring slightly larger than the footprint every two floors on blocks of four or more
 * floors. `f` is the ledge height as a fraction of the building height, so forecast scenarios can scale them with the block.
 */
export function generateLedges(b: FC): FC {
  const features: F[] = [];
  for (const f of b.features) {
    const p = f.properties, levels = Number(p["levels"]), h = Number(p["h"]);
    if (p["mill"] || levels < 4 || f.geometry.type !== "Polygon") continue;
    const pts = f.geometry.coordinates[0]!.slice(0, 4);
    const c: Pos = [pts.reduce((a, q) => a + q[0], 0) / 4, pts.reduce((a, q) => a + q[1], 0) / 4];
    const outer = pts.map(([x, y]) => [c[0] + (x - c[0]) * 1.06, c[1] + (y - c[1]) * 1.06] as Pos);
    const inner = pts.map(([x, y]) => [c[0] + (x - c[0]) * 0.97, c[1] + (y - c[1]) * 0.97] as Pos);
    for (let k = 2; k < levels; k += 2) features.push(ring(outer, inner, { h, f: (k * 3.2) / h, zone: String(p["zone"]), r: Number(p["r"] ?? 0.5) }));
  }
  return { type: "FeatureCollection", features };
}

/**
 * Ground shadows: the footprint swept away from the sun (south-west light, so shadows fall north-east), as the convex hull of the
 * footprint and its offset copy. Length grows with height. Drawn as translucent ground fill under the buildings.
 */
const SUN: Pos = [0.62, 0.78];   // unit direction shadows fall (east, north)
function hull(points: Pos[]): Pos[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pos, a: Pos, b: Pos) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pos[] = [], upper: Pos[] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export function generateShadows(b: FC, trees: FC): FC {
  const features: F[] = [];
  const M = 111320;
  const cast = (pts: Pos[], h: number, kind: string) => {
    const len = h * 1.25;   // metres of shadow per metre of height (sun about 40° up)
    const dx = (SUN[0] * len) / (M * KXr), dy = (SUN[1] * len) / M;
    features.push(poly(hull([...pts, ...pts.map(([x, y]) => [x + dx, y + dy] as Pos)]), { kind }));
  };
  for (const f of b.features) if (f.geometry.type === "Polygon") cast(f.geometry.coordinates[0]!.slice(0, -1), Number(f.properties["h"]), "building");
  for (const f of trees.features) if (f.geometry.type === "Polygon") cast(f.geometry.coordinates[0]!.slice(0, -1), Number(f.properties["h"]) * 0.8, "tree");
  return { type: "FeatureCollection", features };
}

/** Trees: canopies on short trunks along local streets, in the parks and around the lake, kept off buildings, water and roads. */
export function generateTrees(b: FC, seed = 7): { canopies: FC; trunks: FC } {
  const r = rng(seed);
  const spots: Pos[] = [];
  for (const l of LOCAL) for (const p of along(l[0]!, l[1]!, 0.00028)) spots.push([p[0] + 0.00013 / KXr, p[1] + 0.00011]);
  for (const g of GREENS) for (let i = 0; i < 26; i++) spots.push([g[0]![0] + r() * (g[1]![0] - g[0]![0]), g[0]![1] + r() * (g[2]![1] - g[0]![1])]);
  for (const p of scaleRing(LAKE, 1.22)) spots.push(p);
  for (const p of along([72.5085, 22.9958], [72.5135, 22.9952], 0.0002)) spots.push(p);
  const rings = b.features.map((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]! : []));
  const free = (p: Pos) => !inside(p, scaleRing(LAKE, 1.12)) && !inside(p, ROZA) && !rings.some((q) => inside(p, q)) && lineDist(p, HIGHWAY) > 0.0003 && lineDist(p, CANAL) > 0.0002;
  const canopies: F[] = [], trunks: F[] = [];
  for (const p of spots) {
    if (!free(p)) continue;
    const size = 0.000045 + r() * 0.00004, top = 5 + r() * 6;
    const tone = Math.round(r() * 2), rot = r();
    // two tiers read as a rounded crown: a wide lower tier and a narrower, lighter upper one
    canopies.push(poly(ngon(p, size, 9, rot), { b: 2.2, h: top * 0.72, tone }));
    canopies.push(poly(ngon([p[0] + size * 0.15 / KXr, p[1] + size * 0.1], size * 0.68, 8, rot + 0.3), { b: top * 0.6, h: top, tone: Math.min(2, tone + 1) }));
    trunks.push(poly(ngon(p, 0.000007, 4), { h: 2.4 }));
  }
  return { canopies: { type: "FeatureCollection", features: canopies }, trunks: { type: "FeatureCollection", features: trunks } };
}

/** Small street-level detail: market stalls with coloured awnings, bus shelters, a row of parked autos, zebra crossings. */
export const furniture: { solid: FC; flat: FC } = (() => {
  const solid: F[] = [], flat: F[] = [];
  const AWN = ["#d9534f", "#2f7fb5", "#e3a92b", "#3d9a5b", "#9a5bb5"];
  const rect = (c: Pos, l: number, w: number, ang: number): Pos[] => {
    const dx = Math.cos(ang), dy = Math.sin(ang), M = 111320;
    return [[l, w], [-l, w], [-l, -w], [l, -w]].map(([a, b]) => [c[0] + (a! * dx - b! * dy) / (M * KXr), c[1] + (a! * dy + b! * dx) / M] as Pos);
  };
  const heading = (a: Pos, b: Pos) => Math.atan2(b[1] - a[1], (b[0] - a[0]) * KXr);
  // stalls along the factory road (both sides) and at the junction near the shrine approach
  FACTORY_ROAD.slice(1).forEach((b, i) => {
    const a = FACTORY_ROAD[i]!, ang = heading(a, b);
    for (const p of along(a, b, 0.00022)) for (const side of [1, -1]) {
      const off = 0.00011 * side, c: Pos = [p[0] - Math.sin(ang) * off / KXr, p[1] + Math.cos(ang) * off];
      solid.push(poly(rect(c, 1.4, 1.1, ang), { b: 0, h: 1.0, c: "#8a6a4a" }));
      solid.push(poly(rect(c, 1.7, 1.5, ang), { b: 2.1, h: 2.35, c: AWN[(solid.length >> 1) % AWN.length]! }));
    }
  });
  for (const c of along([72.5056, 22.99365], [72.5068, 22.99375], 0.00012)) {
    solid.push(poly(rect(c, 1.2, 0.9, 0), { b: 0, h: 1.0, c: "#7a5a3a" }));
    solid.push(poly(rect(c, 1.5, 1.3, 0), { b: 2.0, h: 2.25, c: AWN[solid.length % AWN.length]! }));
  }
  // bus shelters on the highway service lane
  HIGHWAY.slice(1).forEach((b, i) => {
    const a = HIGHWAY[i]!, ang = heading(a, b);
    for (const p of along(a, b, 0.004).slice(1, -1)) {
      const c: Pos = [p[0] - Math.sin(ang) * 0.00016 / KXr, p[1] + Math.cos(ang) * 0.00016];
      solid.push(poly(rect(c, 5, 1.6, ang), { b: 2.6, h: 2.9, c: "#3b6a8f" }));
      solid.push(poly(rect(c, 4.6, 0.15, ang), { b: 0, h: 2.6, c: "#9aa7b2" }));
    }
  });
  // parked autos at the highway auto stand (yellow-green Ahmedabad CNG autos)
  for (let i = 0; i < 7; i++) solid.push(poly(rect([72.51245 + i * 0.000035, 22.98845], 1.4, 0.7, 0.2), { b: 0, h: 1.8, c: i % 3 ? "#e8c82c" : "#3c9a4a" }));
  // zebra crossing where the arterial meets the highway
  for (let i = -4; i <= 4; i++) flat.push(poly(rect([72.5118 + i * 0.000012, 22.98815], 0.45, 3.2, Math.PI / 2 - 0.08), { c: "#ffffff" }));
  return { solid: { type: "FeatureCollection", features: solid }, flat: { type: "FeatureCollection", features: flat } };
})();

/** Street lamps along the highway and arterials: invisible by day, warm pools of light at dusk and night. */
export const lamps: FC = {
  type: "FeatureCollection",
  features: [...along(HIGHWAY[0]!, HIGHWAY[3]!, 0.0006), ...along(ARTERIAL[0]!, ARTERIAL[3]!, 0.0007), ...along(FACTORY_ROAD[0]!, FACTORY_ROAD[2]!, 0.0006)]
    .map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: c } })),
};

// The generated city is deterministic and costly enough to build once.
let cityCache: { buildings: FC; roofs: FC; ledges: FC; shadows: FC; trees: { canopies: FC; trunks: FC } } | null = null;
export function city() {
  if (!cityCache) {
    const buildings = generateBuildings(), trees = generateTrees(buildings);
    cityCache = { buildings, roofs: generateRoofs(buildings), ledges: generateLedges(buildings), shadows: generateShadows(buildings, trees.canopies), trees };
  }
  return cityCache;
}

// --- themes ----------------------------------------------------------------------------------------------------------------
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export interface Theme {
  bg: string; green: string; ground: string; water: string; waterLine: string; canalFlow: string; road: string; casing: string; highway: string;
  traffic: string; low: string; high: string; mill: string; landmark: string;
  /** plaster variety for low-rise walls, rooftop rooms, water tanks, tree canopy tones, trunk, stone, dome, lane marking, lamp glow */
  low2: string; low3: string; room: string; tank: string; tree: [string, string, string]; trunk: string; stone: string; dome: string; marking: string; lamp: number;
  /** asphalt for streets, ledge/balcony colour, ground-shadow opacity */
  asphalt: string; ledge: string; shadow: number;
  light: maplibregl.LightSpecification; sky: Record<string, string | number>;
}
export const THEMES: Record<TimeOfDay, Theme> = {
  dawn: {
    bg: "#efe2d8", green: "#b3cf9c", ground: "#e6d2b4", water: "#8cb9d4", waterLine: "#5a8fae", canalFlow: "#fff1ea", road: "#c9c2bb", casing: "#e3d6c8",
    highway: "#f1c89a", traffic: "#a0492f", low: "#f0dccb", high: "#a7aec2", mill: "#c49a80", landmark: "#e0a27a",
    low2: "#f2cfc0", low3: "#e2dad0", room: "#d8c6b6", tank: "#2c2a2a", tree: ["#86a874", "#729862", "#9cb882"], trunk: "#76563c", stone: "#dcb092", dome: "#ecc2a0", marking: "#fff8f2", lamp: 0.35, asphalt: "#8d8b8a", ledge: "#f6e6dc", shadow: 0.2,
    light: { anchor: "viewport", color: "#ffd7c2", intensity: 0.45, position: [1.3, 100, 65] },
    sky: { "sky-color": "#a9c6e6", "horizon-color": "#f6c9b4", "fog-color": "#efe2d8", "sky-horizon-blend": 0.75, "horizon-fog-blend": 0.65, "fog-ground-blend": 0.7 },
  },
  day: {
    bg: "#efe8da", green: "#bcd8a4", ground: "#e2d3ae", water: "#7fbfd4", waterLine: "#4c91a3", canalFlow: "#f4fbff", road: "#c4c3bd", casing: "#ddd5c4",
    highway: "#f3cf86", traffic: "#b5522f", low: "#efe2c6", high: "#9fb7b4", mill: "#c9a27e", landmark: "#d9a066",
    low2: "#f0d4c0", low3: "#dfe3d6", room: "#d8ccb4", tank: "#2b2b2b", tree: ["#7fae6a", "#6a9c5a", "#94bd78"], trunk: "#7a5a3c", stone: "#d6b48a", dome: "#e2c49c", marking: "#ffffff", lamp: 0, asphalt: "#8e9193", ledge: "#f7f2e8", shadow: 0.26,
    light: { anchor: "map", color: "#fff6e8", intensity: 0.55, position: [1.5, 225, 38] },
    sky: { "sky-color": "#9cc9e6", "horizon-color": "#f3efe4", "fog-color": "#efe8da", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.75 },
  },
  dusk: {
    bg: "#e7d2c1", green: "#a9bf8f", ground: "#d9bf98", water: "#6b98b8", waterLine: "#3d6b8a", canalFlow: "#ffe2c4", road: "#b5a99f", casing: "#cfb9a4",
    highway: "#f2b073", traffic: "#7a2e1c", low: "#efcfae", high: "#8b8fae", mill: "#b98466", landmark: "#e59a5c",
    low2: "#ecbfa2", low3: "#d6c9b8", room: "#cfb393", tank: "#2a2522", tree: ["#7d9a5e", "#6b8a52", "#8ea66c"], trunk: "#6b4a33", stone: "#e0a476", dome: "#efb886", marking: "#fff4e6", lamp: 0.55, asphalt: "#7f7672", ledge: "#f2dcc8", shadow: 0.18,
    light: { anchor: "viewport", color: "#ffc58a", intensity: 0.5, position: [1.3, 260, 70] },
    sky: { "sky-color": "#f0a37a", "horizon-color": "#f7d2a6", "fog-color": "#e7d2c1", "sky-horizon-blend": 0.8, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.7 },
  },
  night: {
    bg: "#0f1d29", green: "#1c3428", ground: "#2a2a24", water: "#163b55", waterLine: "#2f6e93", canalFlow: "#7fd3ff", road: "#33475a", casing: "#1b2a37",
    highway: "#d89a3c", traffic: "#ffd27a", low: "#2b3e50", high: "#5d7895", mill: "#4a3d36", landmark: "#c98a4a",
    low2: "#334658", low3: "#2a3a48", room: "#3a4f63", tank: "#11161b", tree: ["#1f3a2c", "#1a3326", "#264536"], trunk: "#2a221c", stone: "#a87a4c", dome: "#d6a066", marking: "#8aa0b4", lamp: 1, asphalt: "#26323d", ledge: "#3a4c5e", shadow: 0,
    light: { anchor: "viewport", color: "#a8c4ff", intensity: 0.25, position: [1.2, 40, 50] },
    sky: { "sky-color": "#0b1424", "horizon-color": "#22344d", "fog-color": "#0f1d29", "sky-horizon-blend": 0.7, "horizon-fog-blend": 0.8, "fog-ground-blend": 0.8 },
  },
};

/** Paint values that change with the time of day, per layer. Used for the initial style and for live theme switches. */
export function themedPaint(t: Theme): Record<string, Record<string, unknown>> {
  return {
    background: { "background-color": t.bg },
    greens: { "fill-color": ["match", ["get", "kind"], "ground", t.ground, t.green] },
    water: { "fill-color": t.water },
    "water-line": { "line-color": t.waterLine },
    canal: { "line-color": t.water },
    "canal-flow": { "line-color": t.canalFlow },
    "road-casing": { "line-color": t.casing },
    road: { "line-color": ["match", ["get", "kind"], "local", t.road, t.asphalt] },
    ledges: { "fill-extrusion-color": t.ledge },
    shadows: { "fill-opacity": ["match", ["get", "kind"], "tree", t.shadow * 0.8, t.shadow] },
    "traffic-a": { "line-color": t.traffic },
    "traffic-b": { "line-color": t.traffic },
    buildings: { "fill-extrusion-color": ["case", ["has", "mill"], t.mill,
      ["interpolate", ["linear"], ["get", "h"], 3, ["match", ["%", ["round", ["*", ["coalesce", ["get", "r"], 0], 30]], 3], 0, t.low, 1, t.low2, t.low3], 22, t.low3, 50, t.high]] },
    landmark: { "fill-extrusion-color": ["match", ["get", "part"], "dome", t.dome, "finial", t.highway, "ghat", t.stone, "plinth", t.stone, "parapet", t.dome, t.landmark] },
    roofs: { "fill-extrusion-color": ["match", ["get", "kind"], "tank", t.tank, "parapet", t.low3, t.room] },
    "tree-canopy": { "fill-extrusion-color": ["match", ["get", "tone"], 0, t.tree[0], 1, t.tree[1], t.tree[2]] },
    "tree-trunk": { "fill-extrusion-color": t.trunk },
    "lane-marking": { "line-color": t.marking },
    lamps: { "circle-opacity": t.lamp, "circle-stroke-opacity": t.lamp },
    "vehicle-lights": { "circle-opacity": t.lamp },
  };
}

/** Road width by kind; the zoom interpolation must be the outermost expression in MapLibre. */
const byKind = (hw: number[], art: number[], loc: number[]) => ["interpolate", ["exponential", 1.6], ["zoom"],
  ...[13, 16, 18].flatMap((z, i) => [z, ["match", ["get", "kind"], "highway", hw[i], "arterial", art[i], loc[i]]])];
const w = (z13: number, z16: number, z18: number) => ["interpolate", ["exponential", 1.6], ["zoom"], 13, z13, 16, z16, 18, z18];

/** Dash phases used by the ambient flow animation (a moving dash is drawn by stepping through these). */
export const DASH_STEPS: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

export function buildOfflineStyle(time: TimeOfDay = "day"): maplibregl.StyleSpecification {
  const t = THEMES[time];
  const p = themedPaint(t);
  const extrusionTransition = { duration: 700, delay: 0 };
  return {
    version: 8,
    // no "glyphs" and no "sprite": nothing is ever fetched for this style
    light: t.light,
    sources: {
      greens: { type: "geojson", data: greens as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      water: { type: "geojson", data: water as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      canal: { type: "geojson", data: canal as unknown as maplibregl.GeoJSONSourceSpecification['data'], attribution: BASEMAP_ATTRIBUTION },
      roads: { type: "geojson", data: roads as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      buildings: { type: "geojson", data: city().buildings as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      roofs: { type: "geojson", data: city().roofs as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      ledges: { type: "geojson", data: city().ledges as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      shadows: { type: "geojson", data: city().shadows as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      ground: { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[72.47, 22.96], [72.54, 22.96], [72.54, 23.02], [72.47, 23.02], [72.47, 22.96]]] } } as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      "tree-canopy": { type: "geojson", data: city().trees.canopies as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      "tree-trunk": { type: "geojson", data: city().trees.trunks as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      lamps: { type: "geojson", data: lamps as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      furniture: { type: "geojson", data: furniture.solid as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      markings: { type: "geojson", data: furniture.flat as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      // filled by MapView's traffic animation
      vehicles: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      "vehicle-lights": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      landmark: { type: "geojson", data: landmark as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
    },
    layers: [
      { id: "background", type: "background", paint: p["background"] as never },
      // fine ground grain (image added by MapView on demand); keeps large flat areas from looking like plastic
      { id: "ground-grain", type: "fill", source: "ground", paint: { "fill-pattern": "grain", "fill-opacity": 0.5 } as never },
      { id: "greens", type: "fill", source: "greens", paint: { ...(p["greens"] as object), "fill-opacity": 0.9 } as never },
      { id: "water", type: "fill", source: "water", paint: p["water"] as never },
      { id: "water-depth", type: "line", source: "water", paint: { "line-color": "#2f6f8c", "line-width": 10, "line-blur": 9, "line-offset": -5, "line-opacity": 0.45 } as never },
      { id: "water-line", type: "line", source: "water", paint: { ...(p["water-line"] as object), "line-width": 1.5 } as never },
      { id: "canal", type: "line", source: "canal", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["canal"] as object), "line-width": w(3, 12, 40) } as never },
      { id: "canal-flow", type: "line", source: "canal", layout: { "line-cap": "butt", "line-join": "round" }, paint: { ...(p["canal-flow"] as object), "line-width": w(1, 3, 8), "line-opacity": 0.7, "line-dasharray": DASH_STEPS[0] } as never },
      { id: "road-casing", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["road-casing"] as object), "line-width": byKind([6, 22, 70], [4, 14, 44], [2, 8, 26]) } as never },
      { id: "road", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["road"] as object), "line-width": byKind([4, 18, 60], [3, 11, 36], [1, 6, 20]) } as never },
      { id: "lane-marking", type: "line", source: "roads", minzoom: 14.5, filter: ["!=", ["get", "kind"], "local"], paint: { ...(p["lane-marking"] as object), "line-width": w(0.5, 1, 3), "line-opacity": 0.85, "line-dasharray": [3, 3] } as never },
      { id: "zebra", type: "fill", source: "markings", minzoom: 15.5, paint: { "fill-color": "#ffffff", "fill-opacity": 0.9 } as never },
      { id: "traffic-a", type: "line", source: "roads", filter: ["==", ["get", "kind"], "highway"], paint: { ...(p["traffic-a"] as object), "line-width": w(1, 2.5, 6), "line-offset": w(1, 4, 14), "line-opacity": 0.3, "line-dasharray": DASH_STEPS[0] } as never },
      { id: "traffic-b", type: "line", source: "roads", filter: ["==", ["get", "kind"], "highway"], paint: { ...(p["traffic-b"] as object), "line-width": w(1, 2.5, 6), "line-offset": w(-1, -4, -14), "line-opacity": 0.3, "line-dasharray": DASH_STEPS[7] } as never },
      { id: "shadows", type: "fill", source: "shadows", minzoom: 14.5, paint: { ...(p["shadows"] as object), "fill-color": "#2a2620", "fill-antialias": false } as never },
      { id: "buildings", type: "fill-extrusion", source: "buildings", minzoom: 13, paint: { ...(p["buildings"] as object), "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["get", "h"]], "fill-extrusion-base": 0, "fill-extrusion-opacity": 1, "fill-extrusion-vertical-gradient": true, "fill-extrusion-height-transition": extrusionTransition } as never },
      { id: "ledges", type: "fill-extrusion", source: "ledges", minzoom: 15.8, paint: { ...(p["ledges"] as object), "fill-extrusion-base": ["*", ["get", "h"], ["get", "f"]], "fill-extrusion-height": ["+", ["*", ["get", "h"], ["get", "f"]], 0.35], "fill-extrusion-opacity": 1, "fill-extrusion-base-transition": extrusionTransition, "fill-extrusion-height-transition": extrusionTransition } as never },
      { id: "roofs", type: "fill-extrusion", source: "roofs", minzoom: 15, paint: { ...(p["roofs"] as object), "fill-extrusion-base": ["get", "h"], "fill-extrusion-height": ["+", ["get", "h"], ["get", "extra"]], "fill-extrusion-opacity": 0.95, "fill-extrusion-height-transition": extrusionTransition, "fill-extrusion-base-transition": extrusionTransition } as never },
      { id: "landmark", type: "fill-extrusion", source: "landmark", paint: { ...(p["landmark"] as object), "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-opacity": 1 } as never },
      { id: "tree-trunk", type: "fill-extrusion", source: "tree-trunk", minzoom: 15.5, paint: { ...(p["tree-trunk"] as object), "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } as never },
      { id: "tree-canopy", type: "fill-extrusion", source: "tree-canopy", minzoom: 15, paint: { ...(p["tree-canopy"] as object), "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, ["get", "b"], 15.6, ["get", "h"]], "fill-extrusion-opacity": 0.96 } as never },
      { id: "furniture", type: "fill-extrusion", source: "furniture", minzoom: 15.5, paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } as never },
      { id: "vehicles", type: "fill-extrusion", source: "vehicles", minzoom: 14.5, paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 1 } as never },
      { id: "vehicle-lights", type: "circle", source: "vehicle-lights", minzoom: 15, paint: { ...(p["vehicle-lights"] as object), "circle-color": "#fff4d6", "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 2, 18, 9], "circle-blur": 0.8, "circle-pitch-alignment": "map" } as never },
      { id: "lamps", type: "circle", source: "lamps", minzoom: 14, paint: { ...(p["lamps"] as object), "circle-color": "#ffd58a", "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 18], "circle-blur": 0.9, "circle-pitch-alignment": "map", "circle-stroke-width": 1, "circle-stroke-color": "#fff3d0" } as never },
    ],
  };
}

/** Static HTML labels for the basemap (rendered as aria-hidden markers; the page text carries the same information). */
export const BASE_LABELS: { text: string; at: Pos; kind: "landmark" | "water" | "road" | "area" }[] = [
  { text: "Sarkhej Roza", at: [72.50539, 22.99418], kind: "landmark" },
  { text: "Sarkhej Lake", at: [72.5048, 22.9918], kind: "water" },
  { text: "S.G. Highway", at: [72.498, 22.9975], kind: "road" },
  { text: "Canal", at: [72.5175, 22.9812], kind: "water" },
  { text: "Makarba", at: [72.5075, 22.9946], kind: "area" },
];
