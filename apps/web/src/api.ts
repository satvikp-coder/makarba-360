import { validatePublic } from "@makarba/contracts";

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api/v1/public";

export interface PlaceSummary { id: string; slug: string; name: string; category: string; mediaIds: string[]; geometryType: string }
export interface PublicFeature { type: "Feature"; id: string; geometry: { type: string; coordinates: unknown }; properties: { slug: string; name: unknown; category: string } }
export type PlacesResult =
  | { status: "ok"; places: PlaceSummary[]; features: PublicFeature[]; synthetic: boolean }
  | { status: "error"; retryable: boolean };

/** Fetches published places and validates the payload against the public contract before use. Anything invalid is an error, never shown. */
export async function fetchPlaces(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<PlacesResult> {
  try {
    const res = await fetcher(`${API_BASE}/locations?limit=200`, { signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!res.ok) return { status: "error", retryable: res.status >= 500 };
    const body: unknown = await res.json();
    const v = validatePublic("locations", body);
    if (!v.ok) return { status: "error", retryable: false };
    const c = body as { features: { type: "Feature"; geometry: { type: string; coordinates: unknown }; id: string; properties: { slug: string; name: string | Record<string, string>; category: string; mediaIds?: string[] } }[]; meta?: { datasetKind?: string } };
    const places = c.features.map((f) => ({
      id: f.id, slug: f.properties.slug, category: f.properties.category, mediaIds: f.properties.mediaIds ?? [], geometryType: f.geometry.type,
      name: typeof f.properties.name === "string" ? f.properties.name : (f.properties.name.en ?? Object.values(f.properties.name)[0] ?? f.properties.slug),
    }));
    return { status: "ok", places, features: c.features as unknown as PublicFeature[], synthetic: c.meta?.datasetKind === "synthetic" };
  } catch {
    return { status: "error", retryable: true };
  }
}

export interface Dated { value: string | null; precision: string }
/** Human text for a possibly-unknown, possibly-imprecise date. Never invents precision (a year stays a year). */
export function formatDated(d: Dated | null | undefined): string {
  if (!d || d.value === null || d.value === undefined || d.value === "") return "Date unknown";
  const label: Record<string, string> = { year: "year", month: "month", day: "exact day", decade: "decade", circa: "approximate" };
  return `${d.value} (${label[d.precision] ?? d.precision})`;
}

export interface HistoryData {
  sources: { id: string; citation: string; url: string; licence: string; verificationState: string }[];
  events: { id: string; sourceId: string; date: Dated; evidenceType: string; text: string }[];
  comparisonPairs: { id: string; beforeMediaId: string; afterMediaId: string; beforeDate: Dated; afterDate: Dated; sourceIds: string[]; matchingViewpointNotes: string; evidenceQuality: string }[];
  synthetic: boolean;
}
export type HistoryResult = { status: "ok"; data: HistoryData } | { status: "missing" } | { status: "error"; retryable: boolean };

async function getValidated(kind: "history" | "media", path: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ status: "ok"; body: unknown } | { status: "missing" } | { status: "error"; retryable: boolean }> {
  try {
    // no-store: a withdrawn place must not be served from a stale browser cache
    const res = await fetcher(`${API_BASE}${path}`, { signal, credentials: "omit", cache: "no-store", headers: { Accept: "application/json" } });
    if (res.status === 404) return { status: "missing" };
    if (!res.ok) return { status: "error", retryable: res.status >= 500 };
    const body: unknown = await res.json();
    if (!validatePublic(kind, body).ok) return { status: "error", retryable: false };
    return { status: "ok", body };
  } catch {
    return { status: "error", retryable: true };
  }
}

export async function fetchHistory(slug: string, signal?: AbortSignal, fetcher?: typeof fetch): Promise<HistoryResult> {
  const r = await getValidated("history", `/locations/${encodeURIComponent(slug)}/history`, signal, fetcher);
  if (r.status !== "ok") return r;
  const b = r.body as HistoryData & { meta?: { datasetKind?: string } };
  return { status: "ok", data: { sources: b.sources, events: b.events, comparisonPairs: b.comparisonPairs, synthetic: b.meta?.datasetKind === "synthetic" } };
}

export interface MediaData { id: string; url: string; alt: string; credit: string; licence: string; capturedDate: Dated; format: string; width: number; height: number }
export type MediaResult = { status: "ok"; data: MediaData } | { status: "missing" } | { status: "error"; retryable: boolean };
export async function fetchMedia(id: string, signal?: AbortSignal, fetcher?: typeof fetch): Promise<MediaResult> {
  const r = await getValidated("media", `/media/${encodeURIComponent(id)}`, signal, fetcher);
  if (r.status !== "ok") return r;
  return { status: "ok", data: r.body as MediaData };
}
