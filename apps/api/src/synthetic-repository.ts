import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InvalidFilterError, type PublicRepository } from "./public-api.js";

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../docs/project/contracts/${rel}`, import.meta.url)), "utf8"));

/** In-memory repository over the synthetic fixture bundle. Supports unpublishing so tests can prove withdrawal. NOT for production. */
export function syntheticRepository(opts: { withStories?: boolean } = {}): PublicRepository & { unpublish(slug: string): void; withdrawStories(): void } {
  const bundle = read("fixture-bundle.json");
  const stories = read("proposed/stories-fixture.json");
  const hidden = new Set<string>();
  let storiesOn = opts.withStories ?? false;
  const features = () => bundle.locations.features.filter((f: { properties: { slug: string } }) => !hidden.has(f.properties.slug));
  return {
    unpublish: (slug) => { hidden.add(slug); },
    withdrawStories: () => { storiesOn = false; },
    async listLocations({ limit }) { return { ...bundle.locations, features: features().slice(0, limit), page: { limit, nextCursor: null } }; },
    async getHistory(slug) { return features().some((f: { properties: { slug: string } }) => f.properties.slug === slug) ? bundle.history : null; },
    async getMedia(id) { return id === bundle.media.id ? bundle.media : null; },
    async getInsights({ cohort }) {
      if (cohort !== null && !bundle.insights.cohorts.some((c: { cohortId: string }) => c.cohortId === cohort)) throw new InvalidFilterError("cohort");
      return bundle.insights;
    },
    ...(storiesOn || opts.withStories ? { async getStories() { return storiesOn ? stories : null; } } : {}),
  };
}
