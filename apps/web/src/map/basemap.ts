import type * as maplibregl from "maplibre-gl";

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
export const BASEMAP_ATTRIBUTION = "Basemap: approximate sketch drawn for this prototype, not surveyed";

const poly = (ring: Pos[], properties: Props): F => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] } });
const box = (w: number, s: number, e: number, n: number): Pos[] => [[w, s], [e, s], [e, n], [w, n]];
const line = (coordinates: Pos[], properties: Props): F => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates } });

// --- authored features --------------------------------------------------------------------------------------------------------
export const HIGHWAY: Pos[] = [[72.511, 22.976], [72.5122, 22.988], [72.5138, 22.998], [72.5152, 23.005]];
export const CANAL: Pos[] = [[72.49, 23.0025], [72.497, 23.001], [72.503, 22.9985], [72.509, 22.9972], [72.514, 22.9958], [72.52, 22.9945]];
const ARTERIAL: Pos[] = [[72.49, 22.9872], [72.501, 22.9878], [72.5121, 22.9883], [72.52, 22.9888]];
const FACTORY_ROAD: Pos[] = [[72.5137, 22.9966], [72.5168, 22.9981], [72.5198, 22.9996]];
const LOCAL: Pos[][] = [
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
export const LAKE: Pos[] = [[72.502, 22.9888], [72.5034, 22.9885], [72.505, 22.9888], [72.5052, 22.9897], [72.505, 22.9906], [72.5034, 22.9908], [72.502, 22.9906], [72.5018, 22.9897]];
export const ROZA: Pos[] = box(72.5032, 22.9912, 72.5058, 22.9934);
const MELA = box(72.506, 22.99, 72.5078, 22.9912);
const MILL = box(72.515, 22.9905, 72.5185, 22.9935);
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

/** Simplified massing of the Roza complex: stepped blocks suggest the tomb and its dome, the mosque and the courtyard walls. */
export const landmark: FC = {
  type: "FeatureCollection",
  features: [
    poly(box(72.5032, 22.9912, 72.5058, 22.9914), { h: 5, b: 0 }), poly(box(72.5032, 22.9932, 72.5058, 22.9934), { h: 5, b: 0 }),
    poly(box(72.5032, 22.9912, 72.5034, 22.9934), { h: 5, b: 0 }), poly(box(72.5056, 22.9912, 72.5058, 22.9934), { h: 5, b: 0 }),
    poly(box(72.5043, 22.99215, 72.50495, 22.99275), { h: 13, b: 0 }),
    poly(box(72.50443, 22.99228, 72.50482, 22.99262), { h: 17, b: 13 }),
    poly(box(72.50451, 22.99236, 72.50474, 22.99254), { h: 20, b: 17 }),
    poly(box(72.50458, 22.99241, 72.50467, 22.99249), { h: 22, b: 20 }),
    poly(box(72.5035, 22.9927, 72.5041, 22.99315), { h: 10, b: 0 }),
    poly(box(72.5036, 22.99155, 72.5041, 22.9919), { h: 8, b: 0 }),
  ],
};

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
      features.push(poly(ring, { levels, h: Math.round(levels * 3.2) }));
    }
  }
  // former mill compound: long sheds and one chimney
  for (let i = 0; i < 4; i++) features.push(poly(box(72.5154 + i * 0.0008, 22.991, 72.5159 + i * 0.0008, 22.993), { levels: 3, h: 10, mill: 1 }));
  features.push(poly(box(72.51815, 22.9927, 72.51827, 22.99282), { levels: 11, h: 35, mill: 1 }));
  return { type: "FeatureCollection", features };
}

// --- themes ----------------------------------------------------------------------------------------------------------------
export type TimeOfDay = "day" | "dusk" | "night";
export interface Theme {
  bg: string; green: string; ground: string; water: string; waterLine: string; canalFlow: string; road: string; casing: string; highway: string;
  traffic: string; low: string; high: string; mill: string; landmark: string;
  light: maplibregl.LightSpecification; sky: Record<string, string | number>;
}
export const THEMES: Record<TimeOfDay, Theme> = {
  day: {
    bg: "#efe8da", green: "#bcd8a4", ground: "#e2d3ae", water: "#7fbfd4", waterLine: "#4c91a3", canalFlow: "#f4fbff", road: "#ffffff", casing: "#d3c6ad",
    highway: "#f3cf86", traffic: "#b5522f", low: "#efe2c6", high: "#9fb7b4", mill: "#c9a27e", landmark: "#d9a066",
    light: { anchor: "viewport", color: "#ffffff", intensity: 0.35, position: [1.4, 210, 35] },
    sky: { "sky-color": "#9cc9e6", "horizon-color": "#f3efe4", "fog-color": "#efe8da", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.75 },
  },
  dusk: {
    bg: "#e7d2c1", green: "#a9bf8f", ground: "#d9bf98", water: "#6b98b8", waterLine: "#3d6b8a", canalFlow: "#ffe2c4", road: "#f7ebe0", casing: "#c4a78f",
    highway: "#f2b073", traffic: "#7a2e1c", low: "#efcfae", high: "#8b8fae", mill: "#b98466", landmark: "#e59a5c",
    light: { anchor: "viewport", color: "#ffc58a", intensity: 0.5, position: [1.3, 260, 70] },
    sky: { "sky-color": "#f0a37a", "horizon-color": "#f7d2a6", "fog-color": "#e7d2c1", "sky-horizon-blend": 0.8, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.7 },
  },
  night: {
    bg: "#0f1d29", green: "#1c3428", ground: "#2a2a24", water: "#163b55", waterLine: "#2f6e93", canalFlow: "#7fd3ff", road: "#33475a", casing: "#1b2a37",
    highway: "#d89a3c", traffic: "#ffd27a", low: "#2b3e50", high: "#5d7895", mill: "#4a3d36", landmark: "#c98a4a",
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
    road: { "line-color": ["match", ["get", "kind"], "highway", t.highway, t.road] },
    "traffic-a": { "line-color": t.traffic },
    "traffic-b": { "line-color": t.traffic },
    buildings: { "fill-extrusion-color": ["case", ["has", "mill"], t.mill, ["interpolate", ["linear"], ["get", "h"], 3, t.low, 50, t.high]] },
    landmark: { "fill-extrusion-color": t.landmark },
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
      buildings: { type: "geojson", data: generateBuildings() as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
      landmark: { type: "geojson", data: landmark as unknown as maplibregl.GeoJSONSourceSpecification['data'] },
    },
    layers: [
      { id: "background", type: "background", paint: p["background"] as never },
      { id: "greens", type: "fill", source: "greens", paint: { ...(p["greens"] as object), "fill-opacity": 0.9 } as never },
      { id: "water", type: "fill", source: "water", paint: p["water"] as never },
      { id: "water-line", type: "line", source: "water", paint: { ...(p["water-line"] as object), "line-width": 1.5 } as never },
      { id: "canal", type: "line", source: "canal", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["canal"] as object), "line-width": w(3, 12, 40) } as never },
      { id: "canal-flow", type: "line", source: "canal", layout: { "line-cap": "butt", "line-join": "round" }, paint: { ...(p["canal-flow"] as object), "line-width": w(1, 3, 8), "line-opacity": 0.7, "line-dasharray": DASH_STEPS[0] } as never },
      { id: "road-casing", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["road-casing"] as object), "line-width": byKind([6, 22, 70], [4, 14, 44], [2, 8, 26]) } as never },
      { id: "road", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...(p["road"] as object), "line-width": byKind([4, 18, 60], [3, 11, 36], [1, 6, 20]) } as never },
      { id: "traffic-a", type: "line", source: "roads", filter: ["==", ["get", "kind"], "highway"], paint: { ...(p["traffic-a"] as object), "line-width": w(1, 2.5, 6), "line-offset": w(1, 4, 14), "line-opacity": 0.85, "line-dasharray": DASH_STEPS[0] } as never },
      { id: "traffic-b", type: "line", source: "roads", filter: ["==", ["get", "kind"], "highway"], paint: { ...(p["traffic-b"] as object), "line-width": w(1, 2.5, 6), "line-offset": w(-1, -4, -14), "line-opacity": 0.85, "line-dasharray": DASH_STEPS[7] } as never },
      { id: "buildings", type: "fill-extrusion", source: "buildings", minzoom: 13, paint: { ...(p["buildings"] as object), "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["get", "h"]], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.92, "fill-extrusion-height-transition": extrusionTransition } as never },
      { id: "landmark", type: "fill-extrusion", source: "landmark", paint: { ...(p["landmark"] as object), "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-opacity": 0.95 } as never },
    ],
  };
}

/** Static HTML labels for the basemap (rendered as aria-hidden markers; the page text carries the same information). */
export const BASE_LABELS: { text: string; at: Pos; kind: "landmark" | "water" | "road" | "area" }[] = [
  { text: "Sarkhej Roza", at: [72.5045, 22.99355], kind: "landmark" },
  { text: "Sarkhej Lake", at: [72.5035, 22.9895], kind: "water" },
  { text: "S.G. Highway (approx.)", at: [72.5132, 23.0], kind: "road" },
  { text: "Canal (approx.)", at: [72.4985, 23.0011], kind: "water" },
  { text: "Makarba", at: [72.5075, 22.9946], kind: "area" },
];
