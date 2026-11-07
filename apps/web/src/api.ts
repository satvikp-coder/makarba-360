import { validatePublic } from "@makarba/contracts";

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api/v1/public";

export interface PlaceSummary { id: string; slug: string; name: string; category: string }
export type PlacesResult =
  | { status: "ok"; places: PlaceSummary[]; synthetic: boolean }
  | { status: "error"; retryable: boolean };

/** Fetches published places and validates the payload against the public contract before use. Anything invalid is an error, never shown. */
export async function fetchPlaces(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<PlacesResult> {
  try {
    const res = await fetcher(`${API_BASE}/locations?limit=200`, { signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!res.ok) return { status: "error", retryable: res.status >= 500 };
    const body: unknown = await res.json();
    const v = validatePublic("locations", body);
    if (!v.ok) return { status: "error", retryable: false };
    const c = body as { features: { id: string; properties: { slug: string; name: string | Record<string, string>; category: string } }[]; meta?: { datasetKind?: string } };
    const places = c.features.map((f) => ({
      id: f.id, slug: f.properties.slug, category: f.properties.category,
      name: typeof f.properties.name === "string" ? f.properties.name : (f.properties.name.en ?? Object.values(f.properties.name)[0] ?? f.properties.slug),
    }));
    return { status: "ok", places, synthetic: c.meta?.datasetKind === "synthetic" };
  } catch {
    return { status: "error", retryable: true };
  }
}
