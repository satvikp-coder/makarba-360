import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ARTERIAL, FACTORY_ROAD, HIGHWAY, LAKE, LOCAL, city, furniture, greens, landmark, type FC, type Pos } from "../map/basemap.js";

/**
 * The street-level world, built from exactly the same sketch data as the 3D map (roads, lake, Roza model, generated blocks, trees,
 * street furniture), converted to local metres around the Sarkhej Roza tomb: x east, y up, z south. Pure geometry, no rendering,
 * so it is unit-tested without a GPU. Everything outside RADIUS metres is left out to keep the scene light.
 */
export const ORIGIN: Pos = [72.50547, 22.99351];
const MX = 111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180), MY = 110_540;
export const RADIUS = 720;
/** lon/lat -> local metres [x, z] (z points south, as in three.js with y up). */
export const toLocal = ([lon, lat]: Pos): [number, number] => [(lon - ORIGIN[0]) * MX, -(lat - ORIGIN[1]) * MY];
const near = (p: Pos, r = RADIUS) => { const [x, z] = toLocal(p); return Math.hypot(x, z) < r; };
const ringOf = (f: FC["features"][number]): Pos[] => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]! : []);
const centroid = (r: Pos[]): Pos => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];

/** A flat ring extruded upwards from `base` to `top` metres. */
function prism(ring: Pos[], base: number, top: number): THREE.BufferGeometry {
  const pts = ring.map((p) => { const [x, z] = toLocal(p); return new THREE.Vector2(x, -z); });
  if (pts.length > 2 && pts[0]!.equals(pts[pts.length - 1]!)) pts.pop();
  const shape = new THREE.Shape(pts);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.05, top - base), bevelEnabled: false });
  g.rotateX(-Math.PI / 2);   // shape (x, north) extruded along +Y; north becomes -z
  g.translate(0, base, 0);
  return g;
}
const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
  const n = g.getAttribute("position").count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
};
const merge = (gs: THREE.BufferGeometry[]) => {
  const g = gs.length ? mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)), true) : new THREE.BufferGeometry();
  gs.forEach((x) => x.dispose());
  return g;
};

// --- buildings: one merged mesh; group 0 = roofs, group 1 = walls (window texture tiles in world metres) ---------------------
const PLASTER = ["#efe3cf", "#e9d6bd", "#f3ead9", "#dfc9ad", "#e6d3c4", "#d9c8b4", "#f0dcc0", "#cfd6cf", "#e8cfc2", "#d8d2c5"];
export function buildingsGeometry(): { geometry: THREE.BufferGeometry; count: number } {
  const gs: THREE.BufferGeometry[] = [];
  for (const f of city().buildings.features) {
    const ring = ringOf(f);
    if (!ring.length || !near(centroid(ring))) continue;
    const h = Number(f.properties["h"] ?? 6), r = Number(f.properties["r"] ?? 0.5);
    const tone = f.properties["mill"] ? "#c9a27e" : PLASTER[Math.floor(r * PLASTER.length) % PLASTER.length]!;
    gs.push(paint(prism(ring, 0, h), new THREE.Color(tone)));
  }
  return { geometry: merge(gs), count: gs.length };
}

// --- the Roza complex: stone prisms, plus true hemispherical domes rebuilt from the map model's stepped tiers ------------------
const STONE: Record<string, string> = { stone: "#d9a57a", wall: "#cf9a70", plinth: "#c8956c", parapet: "#e2b48a", ghat: "#b98e6b" };
export interface Dome { x: number; z: number; r: number; base: number; rise: number }
export function landmarkGeometry(): { geometry: THREE.BufferGeometry; domes: Dome[] } {
  const gs: THREE.BufferGeometry[] = [];
  const tiers = new Map<string, { c: Pos; r: number; base: number; top: number }>();
  for (const f of landmark.features) {
    const ring = ringOf(f);
    if (!ring.length) continue;
    const part = String(f.properties["part"] ?? "stone"), b = Number(f.properties["b"] ?? 0), h = Number(f.properties["h"] ?? 1);
    if (part === "dome") {
      const c = centroid(ring), key = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
      const [x0, z0] = toLocal(c), [x1, z1] = toLocal(ring[0]!), r = Math.hypot(x1 - x0, z1 - z0);
      const t = tiers.get(key);
      tiers.set(key, t ? { c, r: Math.max(t.r, r), base: Math.min(t.base, b), top: Math.max(t.top, h) } : { c, r, base: b, top: h });
      continue;
    }
    if (part === "finial") continue;
    if (f.geometry.type === "Polygon" && f.geometry.coordinates.length > 1) {   // rings with a hole: the ghat steps around the lake
      const outer = f.geometry.coordinates[0]!, inner = f.geometry.coordinates[1]!;
      const shape = new THREE.Shape(outer.map((p) => { const [x, z] = toLocal(p); return new THREE.Vector2(x, -z); }));
      shape.holes.push(new THREE.Path(inner.map((p) => { const [x, z] = toLocal(p); return new THREE.Vector2(x, -z); })));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.05, h - b), bevelEnabled: false });
      g.rotateX(-Math.PI / 2); g.translate(0, b - 0.6, 0);
      gs.push(paint(g, new THREE.Color(STONE[part] ?? STONE["stone"]!)));
      continue;
    }
    gs.push(paint(prism(ring, b, h), new THREE.Color(STONE[part] ?? STONE["stone"]!)));
  }
  const domes = [...tiers.values()].map(({ c, r, base, top }) => { const [x, z] = toLocal(c); return { x, z, r, base, rise: top - base }; });
  return { geometry: merge(gs), domes };
}

// --- ground features ----------------------------------------------------------------------------------------------------------
/** A polyline as a flat ribbon `width` metres wide at height y (mitred joins). */
export function ribbon(line: Pos[], width: number, y = 0): THREE.BufferGeometry {
  const p = line.map(toLocal), half = width / 2, pos: number[] = [], idx: number[] = [];
  let run = 0; const uv: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)]!, b = p[Math.min(p.length - 1, i + 1)]!;
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) run += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
    pos.push(p[i]![0] - dz * half, y, p[i]![1] + dx * half, p[i]![0] + dz * half, y, p[i]![1] - dx * half);
    uv.push(0, run / width, 1, run / width);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const clip = (l: Pos[]) => l.filter((p) => near(p, RADIUS + 200));
export function roadsGeometry() {
  const roads = [
    ...[HIGHWAY].map((l) => ({ l: clip(l), w: 26 })), ...[ARTERIAL, FACTORY_ROAD].map((l) => ({ l: clip(l), w: 14 })),
    ...LOCAL.map((l) => ({ l: clip(l), w: 8 })),
  ].filter((r) => r.l.length > 1);
  const asphalt = merge(roads.map((r) => ribbon(r.l, r.w, 0.04)));
  const kerb = merge(roads.map((r) => ribbon(r.l, r.w + 3.2, 0.02)));
  const lines = merge(roads.filter((r) => r.w > 10).map((r) => ribbon(r.l, 0.25, 0.06)));
  return { asphalt, kerb, lines, roads };
}
export const lakeShape = () => new THREE.Shape(LAKE.map((p) => { const [x, z] = toLocal(p); return new THREE.Vector2(x, -z); }));
export function greensGeometry() {
  return merge(greens.features.filter((f) => f.properties["kind"] === "green").map((f) => { const g = new THREE.ShapeGeometry(new THREE.Shape(ringOf(f).map((p) => { const [x, z] = toLocal(p); return new THREE.Vector2(x, -z); }))); g.rotateX(-Math.PI / 2); g.translate(0, 0.05, 0); return g; }));
}
/** Market stalls, awnings, bus shelters, parked autos, the fruit seller's cart and the floor mats, from the map's furniture. */
export function furnitureGeometry() {
  return merge(furniture.solid.features.filter((f) => near(centroid(ringOf(f)))).map((f) =>
    paint(prism(ringOf(f), Number(f.properties["b"] ?? 0), Number(f.properties["h"] ?? 1)), new THREE.Color(String(f.properties["c"] ?? "#888")))));
}
export interface Tree { x: number; z: number; r: number; h: number; tone: number }
export function trees(): Tree[] {
  const out: Tree[] = [];
  const canopies = city().trees.canopies.features;
  for (let i = 0; i < canopies.length; i += 2) {   // the map draws each crown as two tiers: the first one carries size and height
    const f = canopies[i]!, ring = ringOf(f), c = centroid(ring);
    if (!near(c)) continue;
    const [x, z] = toLocal(c), [x1, z1] = toLocal(ring[0]!);
    out.push({ x, z, r: Math.hypot(x1 - x, z1 - z), h: Number(canopies[i + 1]?.properties["h"] ?? 8), tone: Number(f.properties["tone"] ?? 0) });
  }
  return out;
}

// --- people and traffic -------------------------------------------------------------------------------------------------------
export interface Walker { path: [number, number][]; speed: number; offset: number; color: string; scale: number; mode: "walk" | "sit" | "play" }
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const CLOTHES = ["#c0392b", "#2e86c1", "#f4d03f", "#27ae60", "#8e44ad", "#e67e22", "#ecf0f1", "#34495e", "#d35400", "#16a085", "#f5b7b1"];
/** Everyday life at the observed places (children playing by the Baradari, people seated along the waiting edge, customers at the
 *  fruit seller) and pedestrians along the local streets. Anonymous figures only. */
export function walkers(): Walker[] {
  const r = rng(42), out: Walker[] = [];
  const at = (p: Pos): [number, number] => toLocal(p);
  // children playing in loops on the courtyard around the Baradari
  for (let i = 0; i < 9; i++) {
    const c = at([72.50545 + (r() - 0.5) * 0.0002, 22.99309 + (r() - 0.5) * 0.00018]), rad = 2 + r() * 4;
    out.push({ path: Array.from({ length: 9 }, (_, k) => [c[0] + Math.cos((k / 8) * Math.PI * 2) * rad, c[1] + Math.sin((k / 8) * Math.PI * 2) * rad]), speed: 1.6 + r(), offset: r(), color: CLOTHES[i % CLOTHES.length]!, scale: 0.62 + r() * 0.12, mode: "play" });
  }
  for (let i = 0; i < 5; i++) { const c = at([72.50532 + r() * 0.0003, 22.99302 + r() * 0.0002]); out.push({ path: [c], speed: 0, offset: r(), color: CLOTHES[(i + 3) % CLOTHES.length]!, scale: 0.95, mode: "sit" }); }
  // people seated along the edge where food is offered
  const edge: Pos[] = [[72.50576, 22.99332], [72.50578, 22.99341], [72.50583, 22.99349], [72.50595, 22.99352], [72.5062, 22.9935]];
  for (let i = 0; i < 26; i++) {
    const t = i / 25, seg = Math.min(edge.length - 2, Math.floor(t * (edge.length - 1))), k = t * (edge.length - 1) - seg;
    const a = at(edge[seg]!), b = at(edge[seg + 1]!);
    out.push({ path: [[a[0] + (b[0] - a[0]) * k + (r() - 0.5), a[1] + (b[1] - a[1]) * k + (r() - 0.5)]], speed: 0, offset: r(), color: CLOTHES[i % CLOTHES.length]!, scale: 0.92 + r() * 0.1, mode: "sit" });
  }
  // customers at the fruit seller
  const s = at([72.50756, 22.99306]);
  for (let i = 0; i < 3; i++) out.push({ path: [[s[0] - 2 + i * 1.6, s[1] + 2.2]], speed: 0, offset: r(), color: CLOTHES[(i + 6) % CLOTHES.length]!, scale: 1, mode: "walk" });
  // pedestrians walking up and down the local streets
  for (const l of LOCAL.filter((x) => near(x[0]!) || near(x[1]!))) {
    for (let i = 0; i < 5; i++) {
      const a = at(l[0]!), b = at(l[1]!), side = r() < 0.5 ? -1 : 1, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      const ox = (-dz / len) * 5 * side, oz = (dx / len) * 5 * side;
      out.push({ path: [[a[0] + ox, a[1] + oz], [b[0] + ox, b[1] + oz]], speed: 1.1 + r() * 0.5, offset: r(), color: CLOTHES[Math.floor(r() * CLOTHES.length)]!, scale: 0.95 + r() * 0.12, mode: "walk" });
    }
  }
  return out;
}
export interface Vehicle { path: [number, number][]; length: number; speed: number; offset: number; kind: "car" | "auto" | "bus"; color: string; lane: number }
export function vehicles(): Vehicle[] {
  const r = rng(7), out: Vehicle[] = [];
  const lanes: { l: Pos[]; n: number; lanes: number[] }[] = [{ l: HIGHWAY, n: 34, lanes: [-8, -4.5, 4.5, 8] }, { l: ARTERIAL, n: 12, lanes: [-3, 3] }, { l: LOCAL[0]!, n: 4, lanes: [-1.8, 1.8] }];
  for (const { l, n, lanes: ls } of lanes) {
    const path = clip(l).map(toLocal);
    if (path.length < 2) continue;
    const length = path.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]), 0);
    for (let i = 0; i < n; i++) {
      const u = r(), kind = u < 0.35 ? "auto" : u < 0.9 ? "car" : "bus";
      out.push({ path, length, speed: (kind === "bus" ? 8 : kind === "auto" ? 7 : 11) + r() * 3, offset: r(), kind, lane: ls[i % ls.length]!, color: kind === "auto" ? "#d9c52e" : kind === "bus" ? "#c0392b" : ["#ecf0f1", "#2c3e50", "#7f8c8d", "#a93226", "#1f618d", "#d0d3d4"][Math.floor(r() * 6)]! });
    }
  }
  return out;
}
/** Point and heading at distance d along a polyline, offset sideways by `side` metres (right of travel when positive). */
export function along(path: [number, number][], d: number, side = 0): { x: number; z: number; heading: number } {
  let rest = d;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rest <= l || i === path.length - 1) {
      const t = l ? Math.min(1, rest / l) : 0, dx = (b[0] - a[0]) / (l || 1), dz = (b[1] - a[1]) / (l || 1);
      return { x: a[0] + (b[0] - a[0]) * t - dz * side, z: a[1] + (b[1] - a[1]) * t + dx * side, heading: Math.atan2(dx, dz) };
    }
    rest -= l;
  }
  return { x: path[0]![0], z: path[0]![1], heading: 0 };
}

// --- cinematic camera: a drone descent, a walk through the Roza premises, then out along Sarkhej Roza Road -----------------
export interface Shot { pos: [number, number, number]; look: [number, number, number]; caption?: string; sub?: string }
const L = (p: Pos, y: number): [number, number, number] => { const [x, z] = toLocal(p); return [x, y, z]; };
export const TOUR: Shot[] = [
  { pos: L([72.5032, 22.9905], 170), look: L([72.50547, 22.99351], 0), caption: "Makarba, Ahmedabad", sub: "Sarkhej Roza and its tank from the south-west" },
  { pos: L([72.5040, 22.9918], 70), look: L([72.50547, 22.99351], 8) },
  { pos: L([72.5049, 22.9926], 22), look: L([72.50547, 22.99351], 10), caption: "Sarkhej Roza", sub: "The tomb of Shaikh Ahmed Khattu Ganj Bakhsh, 1445–1451" },
  { pos: L([72.50525, 22.99292], 1.7), look: L([72.50552, 22.99313], 3), caption: "Courtyard around the Baradari", sub: "Children play here and people sit in the open courtyard" },
  { pos: L([72.50565, 22.99318], 1.7), look: L([72.50595, 22.99352], 1) },
  { pos: L([72.50585, 22.99338], 1.7), look: L([72.5062, 22.9935], 0.6), caption: "Waiting for food", sub: "People sit along this edge for the food offered in the Roza premises" },
  { pos: L([72.5066, 22.99342], 1.7), look: L([72.5072, 22.99325], 1.6) },
  { pos: L([72.5072, 22.99318], 1.7), look: L([72.50756, 22.99306], 1.2), caption: "Fruit seller on Sarkhej Roza Road", sub: "Trading from the same spot by the road" },
  { pos: L([72.5085, 22.99345], 1.8), look: L([72.5105, 22.99368], 2) },
  { pos: L([72.5105, 22.9933], 45), look: L([72.50547, 22.99351], 0) },
  { pos: L([72.5098, 22.9905], 160), look: L([72.50547, 22.99351], 0), caption: "Makarba 360°", sub: "Walk the streets yourself, or explore the map" },
];
