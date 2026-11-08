import { searchFeatures, LIMITS, type PublicFeatureLike } from "@makarba/geo-search";
import type { PublicFeature } from "./api.js";

/**
 * Where place search gets its answer. The default searches the already-fetched, contract-validated published features
 * (names in every language, aliases, slug). A remote implementation can replace it when the public search API exists (#81),
 * and the explorer discards any answer that is not for the latest query, so a slow older response can never overwrite a newer one.
 */
export interface SearchSource { search(q: string, signal: AbortSignal): Promise<string[]> }
export type SourceFactory = (features: PublicFeature[]) => SearchSource;

export const MAX_Q = LIMITS.maxQueryLength;

export const localSource: SourceFactory = (features) => ({
  async search(q, signal) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const r = searchFeatures(features as unknown as PublicFeatureLike[], { q, limit: LIMITS.maxLimit });
    if (!r.ok) throw new Error(r.error.message);
    return r.value.features.map((f) => f.id);
  },
});

/** Trim, collapse whitespace and cap the length; an empty result means "no search". */
export function cleanQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_Q);
}
