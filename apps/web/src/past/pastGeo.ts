import type { Comparison, Source } from "./pastModel.js";

/**
 * Geometry helpers and the layer registry contract for the Past tab. The registry (data/geo/past/layers.json) is written and validated by
 * packages/gis-io (`past-layer import|check`); this file only reads it, so the page shows exactly what passed validation.
 */
export type LngLat = [number, number];
export type Kind = "roads" | "landuse" | "tp-boundary" | "builtup" | "water" | "green" | "heritage-protection";
export type LayerStatus = "proposed" | "sanctioned" | "implemented" | "observed" | "reconstruction";

export interface Slot { id: string; kind: Kind; title: string; status: "unavailable"; evidenceRequired: string; acceptableSources: string[] }
export interface LayerMeta {
  id: string; kind: Kind; title: string; status: LayerStatus; source: { title: string; url: string }; licence: string;
  asOf: { year: number; precision: "exact" | "year" | "circa" }; accessed: string; method: string; confidence: "high" | "medium" | "low"; limitations: string;
  georeferencing?: { method: string; controlPoints: number; rmseMetres: number };
}
export interface RegLayer { id: string; kind: Kind; title: string; status: "available"; file: string; sha256: string; meta: LayerMeta; counts: { features: number } }
export interface Series {
  id: string; title: string; unit: string; method: string; limits: string; sameAreaAndDefinition: boolean;
  source: Source; points: { label: string; year: number; value: number; approx: boolean }[];
}
export interface Registry { version: 1; slots: Slot[]; layers: RegLayer[]; measurements: Series[] }
export interface Geometry { type: string; coordinates: unknown }
export interface LayerData { type: "FeatureCollection"; features: { geometry: Geometry; properties: Record<string, unknown> }[] }

export const KIND_LABEL: Record<Kind, string> = {
  roads: "Roads", landuse: "Land use", "tp-boundary": "TP scheme boundaries", builtup: "Built-up area", water: "Water", green: "Green cover", "heritage-protection": "Heritage protection areas",
};
export const KIND_COLOUR: Record<Kind, string> = {
  roads: "#7457c4", landuse: "#b9893e", "tp-boundary": "#c2643a", builtup: "#6b6b6b", water: "#2a7fa8", green: "#2f7d4f", "heritage-protection": "#9b1c1c",
};

export type FetchResult<T> = { status: "ok"; data: T } | { status: "missing" } | { status: "error" };
async function getJson<T>(url: string, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<FetchResult<T>> {
  try {
    const r = await fetcher(url, { signal });
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error" };
    return { status: "ok", data: (await r.json()) as T };
  } catch { return { status: "error" }; }
}
export async function fetchRegistry(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<FetchResult<Registry>> {
  const r = await getJson<Registry>("/geo/past/layers.json", signal, fetcher);
  if (r.status === "ok" && (r.data.version !== 1 || !Array.isArray(r.data.slots) || !Array.isArray(r.data.layers))) return { status: "error" };
  return r;
}
export const fetchLayer = (l: RegLayer, signal?: AbortSignal, fetcher: typeof fetch = fetch) => getJson<LayerData>(`/${l.file}`, signal, fetcher);

// ------------------------------------------------------------- comparison rules

export type CompareCheck = { ok: true; kind: "planned-vs-observed" | "change-over-time"; label: string } | { ok: false; reason: string };
/**
 * Whether two layers may be shown against each other. Different kinds, the same year, or a reconstruction on either side are not
 * comparable evidence; a plan against an observation is allowed but labelled as such, never as a measured change.
 */
export function compareCheck(a: RegLayer, b: RegLayer): CompareCheck {
  if (a.id === b.id) return { ok: false, reason: "Choose two different layers." };
  if (a.kind !== b.kind) return { ok: false, reason: `A ${KIND_LABEL[a.kind].toLowerCase()} layer and a ${KIND_LABEL[b.kind].toLowerCase()} layer measure different things, so they are not compared.` };
  if (a.meta.asOf.year === b.meta.asOf.year) return { ok: false, reason: "Both layers describe the same year, so there is no change to show." };
  if (a.meta.status === "reconstruction" || b.meta.status === "reconstruction") return { ok: false, reason: "A reconstruction is illustrative and is not set against observed evidence as a comparison." };
  const planned = (s: LayerStatus) => s === "proposed" || s === "sanctioned";
  if (planned(a.meta.status) !== planned(b.meta.status)) return { ok: true, kind: "planned-vs-observed", label: "A plan set against what was observed: differences show where the plan was not (or not yet) carried out, not a measured change." };
  return { ok: true, kind: "change-over-time", label: "Two dated observations of the same kind." };
}

/** Orders two layers earliest first. */
export const byYear = (a: RegLayer, b: RegLayer) => a.meta.asOf.year - b.meta.asOf.year || a.id.localeCompare(b.id);

// ----------------------------------------------------------------- geometry

export const linesOf = (g: Geometry): LngLat[][] =>
  g.type === "LineString" ? [g.coordinates as LngLat[]] : g.type === "MultiLineString" ? (g.coordinates as LngLat[][]) : [];
export const ringsOf = (g: Geometry): LngLat[][] =>
  g.type === "Polygon" ? [(g.coordinates as LngLat[][])[0]!] : g.type === "MultiPolygon" ? (g.coordinates as LngLat[][][]).map((p) => p[0]!) : [];

/** Shortest distance in metres from a point to a polyline on a local plane (well under 1% error over a few km). */
export function distanceToLineMetres(p: readonly number[], line: readonly (readonly number[])[]): number {
  const k = Math.cos((p[1]! * Math.PI) / 180) * 111319.49, m = 110574;
  const px = p[0]! * k, py = p[1]! * m;
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = line[i]![0]! * k, ay = line[i]![1]! * m, bx = line[i + 1]![0]! * k, by = line[i + 1]![1]! * m;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/** Nearest distance in metres from any vertex of an outline to a road line. Accurate to the outline's vertex spacing, which is stated beside the figure. */
export function outlineToLineMetres(outline: readonly LngLat[], line: readonly LngLat[]): number {
  return Math.min(...outline.map((p) => distanceToLineMetres(p, line)));
}

export interface Frame { x: (lng: number) => number; y: (lat: number) => number }
/** Local equirectangular frame centred on `focus`, `half` degrees of longitude either side, drawn into a w x h box. */
export function makeFrame(focus: LngLat, half: number, w: number, h: number): Frame {
  const k = Math.cos((focus[1] * Math.PI) / 180);
  const hw = half * k, hh = (half * h) / w;
  return { x: (lng) => (((lng - focus[0]) * k + hw) / (2 * hw)) * w, y: (lat) => h - (((lat - focus[1]) + hh) / (2 * hh)) * h };
}
export const pathOf = (pts: readonly LngLat[], f: Frame, close: boolean) =>
  pts.map(([lng, lat], i) => `${i ? "L" : "M"}${f.x(lng).toFixed(1)} ${f.y(lat).toFixed(1)}`).join("") + (close ? "Z" : "");

// ------------------------------------------------------------ measurements

/** Registry measurement series become comparisons only when the series was confirmed to cover the same area and definition in every year. */
export function seriesToComparison(s: Series): Comparison {
  return {
    id: `m-${s.id}`, title: s.title, unit: s.unit, source: s.source, method: s.method, limits: s.limits,
    points: s.sameAreaAndDefinition ? s.points : s.points.slice(0, 1),
  };
}
