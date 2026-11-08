import { findForbiddenField } from "@makarba/contracts";

/**
 * Bounded public spatial search and point clustering (#29). Pure functions over already-published public features
 * (contract v1: Point, MultiLineString, MultiPolygon). Nothing here reads private data; inputs containing a
 * restricted field are dropped, never passed through.
 */
export interface PublicFeatureLike {
  type: "Feature";
  id: string;
  geometry: { type: string; coordinates: unknown };
  properties: { slug: string; name: string | Record<string, string>; category: string; [k: string]: unknown };
}

export type Bbox = readonly [west: number, south: number, east: number, north: number];

export const LIMITS = { maxSpanDegrees: 2, defaultLimit: 50, maxLimit: 200, maxQueryLength: 100, maxZoom: 22 } as const;

export interface SearchError { code: "invalid_bbox" | "invalid_query" | "invalid_limit" | "invalid_cursor" | "invalid_zoom"; message: string; fieldErrors: Record<string, string>; retryable: false }
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: SearchError };
const fail = (code: SearchError["code"], field: string, message: string): { ok: false; error: SearchError } => ({ ok: false, error: { code, message, fieldErrors: { [field]: message }, retryable: false } });

/** Parses "west,south,east,north" (WGS 84 degrees). Rejects instead of repairing anything ambiguous. */
export function parseBbox(raw: string | null | undefined, maxSpan: number = LIMITS.maxSpanDegrees): Parsed<Bbox> {
  if (raw === null || raw === undefined || raw.trim() === "") return fail("invalid_bbox", "bbox", "bbox is required: west,south,east,north");
  const parts = raw.split(",");
  if (parts.length !== 4) return fail("invalid_bbox", "bbox", "bbox needs exactly four numbers: west,south,east,north");
  if (parts.some((p) => p.trim() === "" || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(p.trim()))) return fail("invalid_bbox", "bbox", "bbox values must be plain decimal numbers");
  const [w, s, e, n] = parts.map(Number) as [number, number, number, number];
  if (![w, e].every((x) => x >= -180 && x <= 180) || ![s, n].every((x) => x >= -90 && x <= 90)) return fail("invalid_bbox", "bbox", "longitude must be within -180..180 and latitude within -90..90");
  if (w > e) return fail("invalid_bbox", "bbox", "bbox crosses the antimeridian (west is greater than east); send two separate boxes");
  if (s >= n || w >= e) return fail("invalid_bbox", "bbox", "bbox must have positive width and height (west<east, south<north)");
  if (e - w > maxSpan || n - s > maxSpan) return fail("invalid_bbox", "bbox", `bbox is larger than the allowed ${maxSpan} degrees on a side; zoom in`);
  return { ok: true, value: [w, s, e, n] };
}

/** Bounding box of any supported geometry, or null if coordinates are malformed. */
export function featureBbox(f: PublicFeatureLike): Bbox | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, any = false;
  const walk = (c: unknown): boolean => {
    if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      const [x, y] = c as [number, number];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); any = true; return true;
    }
    return Array.isArray(c) && c.every(walk);
  };
  return walk(f.geometry.coordinates) && any ? [w, s, e, n] : null;
}

const intersects = (a: Bbox, b: Bbox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Case-, accent- and whitespace-insensitive form used for name/alias matching. */
export function normalise(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
const namesOf = (f: PublicFeatureLike): string[] => {
  const n = f.properties.name;
  const aliases = Array.isArray(f.properties["aliases"]) ? (f.properties["aliases"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return [...(typeof n === "string" ? [n] : Object.values(n)), ...aliases, f.properties.slug];
};

export interface SearchQuery { bbox?: Bbox; q?: string; categories?: string[]; limit?: number; after?: string }
export interface SearchResult { features: PublicFeatureLike[]; total: number; nextCursor: string | null; dropped: number }

/** Result order is by feature id, so ids and pages are stable between calls and independent of input order. */
export function searchFeatures(input: PublicFeatureLike[], query: SearchQuery): Parsed<SearchResult> {
  const limit = query.limit ?? LIMITS.defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.maxLimit) return fail("invalid_limit", "limit", `limit must be an integer 1-${LIMITS.maxLimit}`);
  if (query.q !== undefined && query.q.length > LIMITS.maxQueryLength) return fail("invalid_query", "q", `q is longer than ${LIMITS.maxQueryLength} characters`);
  const q = query.q === undefined ? "" : normalise(query.q);
  let dropped = 0;
  const clean = input.filter((f) => {
    const bad = findForbiddenField(f) !== null || featureBbox(f) === null;
    if (bad) dropped++;
    return !bad;
  });
  const seen = new Set<string>();
  const matches = clean
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
    .filter((f) => !query.bbox || intersects(featureBbox(f)!, query.bbox))
    .filter((f) => !query.categories?.length || query.categories.includes(f.properties.category))
    .filter((f) => q === "" || namesOf(f).some((n) => normalise(n).includes(q)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let start = 0;
  if (query.after !== undefined) {
    if (!/^[0-9a-f-]{36}$/i.test(query.after)) return fail("invalid_cursor", "after", "cursor is not a valid feature id");
    start = matches.findIndex((f) => f.id > query.after!);
    if (start === -1) start = matches.length;
  }
  const page = matches.slice(start, start + limit);
  return { ok: true, value: { features: page, total: matches.length, nextCursor: start + limit < matches.length ? page[page.length - 1]!.id : null, dropped } };
}

export interface Cluster { clusterId: string; count: number; center: [number, number]; memberIds: string[] }
export interface ClusterResult { clusters: Cluster[]; singles: PublicFeatureLike[]; others: PublicFeatureLike[] }

/**
 * Deterministic grid clustering of Point features only; lines and areas are returned untouched in `others` so they are
 * never merged into point clusters. A cell with a single point yields that point in `singles`. Cluster ids derive from
 * the sorted member ids, so they are stable for the same members regardless of input order or map pan.
 */
export function clusterPoints(input: PublicFeatureLike[], zoom: number, cellPixels = 60): Parsed<ClusterResult> {
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > LIMITS.maxZoom) return fail("invalid_zoom", "zoom", `zoom must be between 0 and ${LIMITS.maxZoom}`);
  const cellDeg = (cellPixels * 360) / (256 * 2 ** zoom);
  const cells = new Map<string, PublicFeatureLike[]>();
  const others: PublicFeatureLike[] = [];
  const seen = new Set<string>();
  for (const f of input) {
    if (findForbiddenField(f) !== null || seen.has(f.id)) continue;
    seen.add(f.id);
    const c = f.geometry.coordinates;
    if (f.geometry.type !== "Point") { if (featureBbox(f)) others.push(f); continue; }
    if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number" || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const key = `${Math.floor((c[0] + 180) / cellDeg)}:${Math.floor((c[1] + 90) / cellDeg)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(f);
  }
  const clusters: Cluster[] = [];
  const singles: PublicFeatureLike[] = [];
  for (const members of cells.values()) {
    if (members.length === 1) { singles.push(members[0]!); continue; }
    const ids = members.map((m) => m.id).sort();
    const pts = members.map((m) => m.geometry.coordinates as [number, number]);
    clusters.push({ clusterId: `c-${fnv(ids.join("|"))}`, count: members.length, memberIds: ids, center: [mean(pts.map((p) => p[0])), mean(pts.map((p) => p[1]))] });
  }
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
  clusters.sort((a, b) => (a.clusterId < b.clusterId ? -1 : 1));
  return { ok: true, value: { clusters, singles: singles.sort(byId), others: others.sort(byId) } };
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function fnv(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
