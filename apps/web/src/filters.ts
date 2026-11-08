import type { PlaceSummary, PublicFeature } from "./api.js";

/** Map layers a visitor can switch: groups of geometry kinds. Unknown kinds fall under no layer and are never silently hidden by "all". */
export const LAYERS = [
  { id: "points", label: "Points", types: ["Point", "MultiPoint"] },
  { id: "lines", label: "Streets and routes", types: ["LineString", "MultiLineString"] },
  { id: "areas", label: "Areas", types: ["Polygon", "MultiPolygon"] },
] as const;
export type LayerId = (typeof LAYERS)[number]["id"];

export interface Filters { categories: string[]; layers: LayerId[] }

const csv = (v: string | null): string[] => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);

/**
 * Reads filters from the URL. Only values that exist in the data are honoured (a hand-edited or stale link such as
 * ?category=zzz is ignored, not turned into an empty map). Empty list means "no restriction".
 */
export function parseFilters(params: URLSearchParams, knownCategories: string[]): Filters {
  const known = new Set(knownCategories);
  const layerIds = new Set<string>(LAYERS.map((l) => l.id));
  return {
    categories: [...new Set(csv(params.get("category")).filter((c) => known.has(c)))],
    layers: [...new Set(csv(params.get("layers")).filter((l): l is LayerId => layerIds.has(l)))],
  };
}

export function writeFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  if (f.categories.length) next.set("category", f.categories.join(",")); else next.delete("category");
  if (f.layers.length) next.set("layers", f.layers.join(",")); else next.delete("layers");
  return next;
}

export const isActive = (f: Filters) => f.categories.length > 0 || f.layers.length > 0;

export function matches(p: Pick<PlaceSummary, "category" | "geometryType">, f: Filters): boolean {
  if (f.categories.length && !f.categories.includes(p.category)) return false;
  if (f.layers.length) {
    const ok = LAYERS.some((l) => f.layers.includes(l.id) && (l.types as readonly string[]).includes(p.geometryType));
    if (!ok) return false;
  }
  return true;
}

export function applyFilters(places: PlaceSummary[], features: PublicFeature[], f: Filters): { places: PlaceSummary[]; features: PublicFeature[] } {
  const keep = places.filter((p) => matches(p, f));
  const ids = new Set(keep.map((p) => p.id));
  return { places: keep, features: features.filter((x) => ids.has(String(x.id))) };
}

export function toggle<T>(list: T[], v: T): T[] { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }
