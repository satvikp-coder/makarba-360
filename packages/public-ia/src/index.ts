/**
 * Public information architecture (issue #13). Single source of truth for public routes (P01-P13).
 * The public site is read-only: every route is a GET page and there is no survey submission entry.
 */
export type NavGroup = "Explore" | "Then & Now" | "Community Voices" | "Urban Insights" | "Research" | "footer";

export interface PublicRoute {
  id: string; // screen id from docs/product/screen-inventory.md
  path: string; // URL pattern
  title: string;
  nav: NavGroup;
  /** Text/list alternative that exists without the map, canvas, slider or WebGL. */
  alternative: string;
  /** Required states every route must define. */
  states: readonly ("loading" | "empty" | "error")[];
  /** URL-state parameters allowed on this route (privacy-safe filters only). */
  query: readonly string[];
}

const S = ["loading", "empty", "error"] as const;

export const publicRoutes: readonly PublicRoute[] = [
  { id: "P01", path: "/", title: "Home", nav: "Explore", alternative: "text hero and featured-place list", states: S, query: [] },
  { id: "P02", path: "/explore", title: "Explore the map", nav: "Explore", alternative: "searchable place list", states: S, query: ["q", "category", "layers", "place"] },
  { id: "P03", path: "/explore", title: "Explore (mobile)", nav: "Explore", alternative: "searchable place list", states: S, query: ["q", "category", "layers", "place"] },
  { id: "P04", path: "/explore/search", title: "Search places", nav: "Explore", alternative: "result list with clear-filters action", states: S, query: ["q", "category", "layers"] },
  { id: "P05", path: "/places/:slug", title: "Place profile", nav: "Explore", alternative: "text profile with sources", states: S, query: [] },
  { id: "P06", path: "/places/:slug/then-and-now", title: "Then & Now", nav: "Then & Now", alternative: "side-by-side images with text descriptions", states: S, query: [] },
  { id: "P07", path: "/places/:slug/panorama", title: "Panorama", nav: "Then & Now", alternative: "dated static photograph", states: S, query: [] },
  { id: "P08", path: "/voices", title: "Community Voices", nav: "Community Voices", alternative: "list of approved stories", states: S, query: ["theme", "place"] },
  { id: "P09", path: "/insights", title: "Urban Insights", nav: "Urban Insights", alternative: "accessible data tables", states: S, query: ["cohort", "stakeholder", "place", "period"] },
  { id: "P10", path: "/stories/:id", title: "Guided location story", nav: "Then & Now", alternative: "ordered stop list", states: S, query: [] },
  { id: "P11", path: "/research/methodology", title: "Research methodology", nav: "Research", alternative: "plain text page", states: S, query: [] },
  { id: "P12", path: "/research/sources", title: "Sources and credits", nav: "footer", alternative: "plain text page", states: S, query: [] },
  { id: "P13", path: "/accessibility", title: "Accessibility and language", nav: "footer", alternative: "plain text page", states: S, query: [] },
];

/** Query keys that must never appear in public URLs (raw research data or write intents). */
export const forbiddenQueryKeys = ["interview", "participant", "respondent", "gps", "lat", "lng", "coords", "token", "submit", "survey"] as const;
export const mainNavigation: readonly NavGroup[] = ["Explore", "Then & Now", "Community Voices", "Urban Insights", "Research"];

/** Strip unknown or forbidden query parameters before they reach app state or the API. */
export function sanitizeQuery(routeId: string, params: URLSearchParams): URLSearchParams {
  const route = publicRoutes.find((r) => r.id === routeId);
  const out = new URLSearchParams();
  if (!route) return out;
  for (const [k, v] of params) {
    if (route.query.includes(k) && !forbiddenQueryKeys.some((f) => k.toLowerCase().includes(f))) out.append(k, v.slice(0, 120));
  }
  return out;
}
