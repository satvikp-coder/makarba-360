import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Forecasts } from "./Forecasts.js";
import { Link, NavLink, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { sanitizeQuery } from "@makarba/public-ia";
import { mainNavigation, publicRoutes, type NavGroup } from "@makarba/public-ia";
import { fetchPlaces, type PlaceSummary, type PlacesResult } from "./api.js";
import { categoryColor, categoryLabel } from "./categories.js";
import { LandmarkCard, landmarksFor } from "./landmarks.js";
import { DataNote } from "./DataNote.js";
import { Home } from "./Home.js";
import { AccessibilityHelp, Methodology, Sources } from "./ResearchPages.js";
import { NotFound } from "./NotFound.js";
import { PlaceProfile } from "./Profile.js";
import { PanoramaPage } from "./PanoramaPage.js";
import { ThenNowPage } from "./ThenNowPage.js";
import { Voices } from "./Voices.js";
import { Insights } from "./Insights.js";
import type { MapStatus } from "./map/MapView.js";
// The map library is large and only the explorer needs it, so it is loaded when that page is opened.
const MapView = lazy(() => import("./map/MapView.js").then((m) => ({ default: m.MapView })));
import { LANGUAGES, strings, type Lang } from "./i18n.js";
import { cleanQuery, localSource, type SourceFactory } from "./searchSource.js";
import { applyFilters, isActive, LAYERS, parseFilters, toggle, writeFilters, type Filters } from "./filters.js";

const NAV_TARGET: Record<Exclude<NavGroup, "footer">, string> = {
  Explore: "/explore", "Then & Now": "/stories/index", "Community Voices": "/voices", "Urban Insights": "/insights", Research: "/research/methodology",
};
const FOOTER = publicRoutes.filter((r) => r.nav === "footer");

function Layout() {
  const headerRef = useRef<HTMLElement>(null);
  // Publish the header height so the full-height sheet starts below it and navigation is never covered.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang];
  const loc = useLocation();
  useEffect(() => { document.documentElement.lang = lang === "en" || !LANGUAGES.find((l) => l.code === lang)?.available ? "en" : lang; }, [lang]);
  // In-page links such as the footer's "About this data" (/research/methodology#prototype-data) land on their section.
  useEffect(() => { if (loc.hash) document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView?.(); }, [loc.pathname, loc.hash]);
  useEffect(() => { document.title =`${titleFor(loc.pathname)} – ${t.siteName}`; }, [loc.pathname, t.siteName]);
  return (
    <>
      <a className="skip" href="#main">{t.skip}</a>
      <header ref={headerRef}>
        <Link to="/" className="brand">{t.siteName}</Link>
        <nav aria-label={t.navLabel}>
          <ul>
            {mainNavigation.map((g) => (
              <li key={g}><NavLink to={NAV_TARGET[g as Exclude<NavGroup, "footer">]}>{g}</NavLink></li>
            ))}
            <li><NavLink to="/forecasts">Outlook</NavLink></li>
          </ul>
        </nav>
        <label className="lang">
          <span className="visually-hidden">{t.language}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code} disabled={!l.available}>{l.available ? l.label : `${l.label} (${t.languagePending})`}</option>)}
          </select>
        </label>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <nav aria-label={t.footerLabel}>
          <ul>{FOOTER.map((r) => <li key={r.id}><Link to={r.path}>{r.title}</Link></li>)}</ul>
        </nav>
        <p className="footer-note">{t.footerNote} <Link to="/research/methodology#prototype-data">About this data</Link></p>
      </footer>
    </>
  );
}

function titleFor(path: string): string {
  const route = publicRoutes.find((r) => !r.path.includes(":") && r.path === path);
  return route?.title ?? "Makarba 360°";
}

/** List alternative for the map (P02-P04): same published places, no map or WebGL needed. */
export function PlaceList({ fetcher, withMap = false, makeSource = localSource }: { fetcher?: typeof fetch; withMap?: boolean; makeSource?: SourceFactory }) {
  const t = strings.en;
  // Selection lives in the URL (?place=<public feature id>) so it survives reload, sharing and back/forward.
  const [params, setParams] = useSearchParams();
  const selected = withMap ? (sanitizeQuery("P02", params).get("place") ?? null) : null;
  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(sanitizeQuery("P02", params));
    if (id) next.set("place", id); else next.delete("place");
    setParams(next);
  };
  const [r, setR] = useState<PlacesResult | "loading">("loading");
  const categories = r !== "loading" && r.status === "ok" ? [...new Set(r.places.map((p) => p.category))].sort() : [];
  const filters: Filters = withMap ? parseFilters(params, categories) : { categories: [], layers: [] };
  const setFilters = (f: Filters) => setParams(writeFilters(new URLSearchParams(sanitizeQuery("P02", params)), f));
  // Search: the query lives in the URL (?q=). Only the answer to the LATEST query is ever applied.
  const q = withMap ? cleanQuery(params.get("q")) : "";
  const [typed, setTyped] = useState(q);
  const [found, setFound] = useState<{ q: string; ids: Set<string> } | { q: string; error: true } | null>(null);
  const latest = useRef(0);
  const features = r !== "loading" && r.status === "ok" ? r.features : null;
  useEffect(() => { setTyped(q); }, [q]);
  useEffect(() => {
    if (!q || !features) { setFound(null); return; }
    const mine = ++latest.current;
    const ac = new AbortController();
    makeSource(features).search(q, ac.signal).then(
      (ids) => { if (mine === latest.current && !ac.signal.aborted) setFound({ q, ids: new Set(ids) }); },
      () => { if (mine === latest.current && !ac.signal.aborted) setFound({ q, error: true }); },
    );
    return () => ac.abort();
  }, [q, features, makeSource]);
  const setQuery = (next: string) => {
    const p = new URLSearchParams(sanitizeQuery("P02", params));
    const c = cleanQuery(next);
    if (c) p.set("q", c); else p.delete("q");
    setParams(p);
  };
  const searchReady = q !== "" && found !== null && found.q === q && !("error" in found) ? found.ids : null;
  const searchPending = q !== "" && (found === null || found.q !== q);
  const searchFailed = q !== "" && found !== null && found.q === q && "error" in found;
  const base = r !== "loading" && r.status === "ok" ? applyFilters(r.places, r.features, filters) : { places: [], features: [] };
  // ids returned by a source that are not published places are ignored, so a private candidate can never appear
  const view = searchReady ? { places: base.places.filter((p) => searchReady.has(p.id)), features: base.features.filter((f) => searchReady.has(String(f.id))) } : searchPending || searchFailed ? { places: [], features: [] } : base;
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  // Sheet height on small screens: peek / half / full. Always operable by buttons; Escape returns to peek.
  const [sheet, setSheet] = useState<"peek" | "half" | "full">("peek");
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) setSheet((x) => (x === "peek" ? "half" : x)); }, [selected]);
  const load = useCallback(() => {
    const ac = new AbortController();
    setR("loading");
    fetchPlaces(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher]);
  useEffect(() => load(), [load]);
  return (
    <section aria-labelledby="h" className={withMap ? "explore-page" : undefined}>
      <h1 id="h">{t.listTitle}</h1>
      <p className="lead">{t.listIntro}</p>
      <div role="status" aria-live="polite">
        {r === "loading" && t.loading}
        {r !== "loading" && r.status === "error" && <span>{t.errorPlaces}</span>}
        {r !== "loading" && r.status === "ok" && r.places.length === 0 && <span>{t.emptyPlaces}</span>}
      </div>
      {r !== "loading" && r.status === "error" && r.retryable && <button type="button" onClick={load}>{t.retry}</button>}
      {withMap && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <form className="search" role="search" aria-label="Search places" onSubmit={(e) => { e.preventDefault(); setQuery(typed); }}>
          <label htmlFor="place-search">Search places</label>
          <input id="place-search" type="search" value={typed} maxLength={100} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" className="btn">Search</button>
          {q && <button type="button" onClick={() => { setTyped(""); setQuery(""); }}>Clear search</button>}
          <p role="status" aria-live="polite" className="search-status">
            {searchPending && "Searching…"}
            {searchFailed && "Search could not be completed. Clear the search to see all places."}
            {searchReady && (view.places.length === 0 ? `No places match “${q}”.` : `${view.places.length} ${view.places.length === 1 ? "place matches" : "places match"} “${q}”.`)}
          </p>
        </form>
      )}
      {withMap && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <div className="filters" role="group" aria-label="Filter places">
          <fieldset>
            <legend>Category</legend>
            {categories.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={filters.categories.includes(c)} onClick={() => setFilters({ ...filters, categories: toggle(filters.categories, c) })}><span className="swatch" style={{ background: categoryColor(c) }} aria-hidden="true" />{categoryLabel(c)}</button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Map layers <small>(none selected shows all)</small></legend>
            {LAYERS.map((l) => (
              <label key={l.id} className="chip-check"><input type="checkbox" checked={filters.layers.includes(l.id)} onChange={() => setFilters({ ...filters, layers: toggle(filters.layers, l.id) })} /> {l.label}</label>
            ))}
          </fieldset>
          {isActive(filters) && <button type="button" onClick={() => setFilters({ categories: [], layers: [] })}>Reset filters</button>}
          <p role="status" aria-live="polite" className="filter-count">
            {isActive(filters) || q ? `Showing ${view.places.length} of ${r.places.length} places.` : `Showing all ${r.places.length} places.`}
            {view.places.length === 0 && !q && " No places match these filters."}
          </p>
        </div>
      )}
      {withMap ? (
        <div className="explore">
          <div className="explore-map">
      {withMap && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <Suspense fallback={<p role="status">Loading map…</p>}><MapView features={view.features} sourceAttribution={r.synthetic ? "Places: prototype example data (fictional)" : "Place data: Makarba 360 published snapshot"} selectedId={selected} onSelect={setSelected} onStatus={setMapStatus} /></Suspense>
      )}
          </div>
          <div className="sheet" data-state={sheet} ref={sheetRef}
            onKeyDown={(e) => { if (e.key === "Escape" && sheet !== "peek") { setSheet("peek"); } }}>
            <div className="sheet-bar" role="group" aria-label="Places panel size">
              <span id="sheet-title">Places and details</span>
              <button type="button" aria-expanded={sheet !== "peek"} aria-controls="sheet-body" onClick={() => setSheet(sheet === "full" ? "half" : "full")}>
                {sheet === "full" ? "Collapse" : "Expand"}
              </button>
              {sheet !== "peek" && <button type="button" onClick={() => setSheet("peek")}>Close</button>}
            </div>
            <div id="sheet-body" className="sheet-body" role="region" aria-labelledby="sheet-title">
      {withMap && r !== "loading" && r.status === "ok" && selected && (() => {
        const p = r.places.find((x) => x.id === selected);
        return p ? (
          <SelectedPlace key={p.id} p={p} synthetic={r.synthetic} onClear={() => setSelected(null)} />
        ) : (
          <aside role="status">That place was not found. It may have been unpublished. <button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>
        );
      })()}
      {withMap && mapStatus === "unavailable" && <p><small>Map unavailable - the list is the full alternative.</small></p>}
      {r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <>
          {r.synthetic && <DataNote />}
          <ul className="place-list">{view.places.map((p, i) => (
            <li key={p.id} style={{ "--i": Math.min(i, 12) } as CSSProperties}>
              <span className="swatch" style={{ background: categoryColor(p.category) }} aria-hidden="true" />
              {withMap ? <button type="button" aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>{p.name}</button> : p.name}{" "}
              <small>({categoryLabel(p.category)})</small>
              {selected === p.id && <span role="status"> - selected</span>}
            </li>
          ))}</ul>
        </>
      )}
            </div>
          </div>
        </div>
      ) : (
        <>
      {withMap && r !== "loading" && r.status === "ok" && selected && (() => {
        const p = r.places.find((x) => x.id === selected);
        return p ? (
          <aside aria-label="Selected place"><h2>{p.name}</h2><p>Category: {p.category}</p><p><Link to={`/places/${p.slug}`}>Open full profile</Link></p><button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>
        ) : (
          <aside role="status">That place was not found. It may have been unpublished. <button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>
        );
      })()}
      {withMap && mapStatus === "unavailable" && <p><small>Map unavailable - the list is the full alternative.</small></p>}
      {r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <>
          {r.synthetic && <DataNote />}
          <ul>{r.places.map((p) => (
            <li key={p.id}>
              {withMap ? <button type="button" aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>{p.name}</button> : p.name}{" "}
              <small>({p.category})</small>
              {selected === p.id && <span role="status"> - selected</span>}
            </li>
          ))}</ul>
        </>
      )}
        </>
      )}
    </section>
  );
}

/** Details of the selected place. Fictional demo details and sourced landmark notes are labelled separately. */
function SelectedPlace({ p, synthetic, onClear }: { p: PlaceSummary; synthetic: boolean; onClear: () => void }) {
  const notes = landmarksFor(p.slug);
  return (
    <aside aria-label="Selected place" className="selected-place">
      <h2>{p.name}</h2>
      <p><span className="swatch" style={{ background: categoryColor(p.category) }} aria-hidden="true" />Category: {categoryLabel(p.category)}</p>
      <p><Link to={`/places/${p.slug}`}>Open full profile</Link></p>
      <button type="button" onClick={onClear}>Clear selection</button>
      {synthetic && <DataNote />}
      {notes.map((l) => <LandmarkCard key={l.id} l={l} />)}
    </aside>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <section aria-labelledby="h">
      <h1 id="h">{title}</h1>
      <p>{strings.en.building}</p>
    </section>
  );
}

const seen = new Set<string>();
const pageRoutes = publicRoutes.filter((r) => r.path !== "/" && r.path !== "/explore" && r.path !== "/places/:slug" && r.path !== "/places/:slug/panorama" && r.path !== "/places/:slug/then-and-now" && r.path !== "/voices" && r.path !== "/insights" && !["/research/methodology", "/research/sources", "/accessibility"].includes(r.path) && !seen.has(r.path) && !!seen.add(r.path));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/explore" element={<PlaceList withMap />} />
        <Route path="/places/:slug" element={<PlaceProfile />} />
        <Route path="/places/:slug/panorama" element={<PanoramaPage />} />
        <Route path="/places/:slug/then-and-now" element={<ThenNowPage />} />
        <Route path="/voices" element={<Voices />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/forecasts" element={<Forecasts />} />
        <Route path="/research/methodology" element={<Methodology />} />
        <Route path="/research/sources" element={<Sources />} />
        <Route path="/accessibility" element={<AccessibilityHelp />} />
        {pageRoutes.map((r) => <Route key={r.path} path={r.path} element={<Pending title={r.title} />} />)}
        <Route path="/stories/index" element={<Pending title="Then & Now" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
