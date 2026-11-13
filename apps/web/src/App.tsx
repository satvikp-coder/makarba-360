import type React from "react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import { publicRoutes, sanitizeQuery } from "@makarba/public-ia";
import { fetchPlaces, type PlaceSummary, type PlacesResult } from "./api.js";
import { CATEGORY_ICON, categoryColor, categoryLabel } from "./categories.js";
import { Layout, plainKey } from "./Shell.js";
import { photoFor } from "./placePhotos.js";
import { LandmarkCard, landmarksFor } from "./landmarks.js";
import { Icon } from "./Icon.js";
import { ParticleLoader } from "./Particles.js";
import { useMapState } from "./mapCtx.js";
import { NotFound } from "./NotFound.js";
import { strings } from "./i18n.js";
import { cleanQuery, localSource, type SourceFactory } from "./searchSource.js";
import { applyFilters, isActive, LAYERS, parseFilters, toggle, writeFilters, type Filters } from "./filters.js";

// Every page is a floating panel over the always-on 3D map; each loads on first visit so the first paint stays light.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const Home = page(() => import("./Home.js") as Promise<Record<"Home", React.ComponentType>>, "Home");
const Forecasts = page(() => import("./Forecasts.js") as Promise<Record<"Forecasts", React.ComponentType>>, "Forecasts");
const Insights = page(() => import("./Insights.js") as Promise<Record<"Insights", React.ComponentType>>, "Insights");
const Voices = page(() => import("./Voices.js") as Promise<Record<"Voices", React.ComponentType>>, "Voices");
const PlaceProfile = page(() => import("./Profile.js") as Promise<Record<"PlaceProfile", React.ComponentType>>, "PlaceProfile");
const PanoramaPage = page(() => import("./PanoramaPage.js") as Promise<Record<"PanoramaPage", React.ComponentType>>, "PanoramaPage");
const ThenNowPage = page(() => import("./ThenNowPage.js") as Promise<Record<"ThenNowPage", React.ComponentType>>, "ThenNowPage");
const ComparisonIndex = page(() => import("./ComparisonIndex.js") as Promise<Record<"ComparisonIndex", React.ComponentType>>, "ComparisonIndex");
const Methodology = page(() => import("./ResearchPages.js") as Promise<Record<"Methodology", React.ComponentType>>, "Methodology");
const Sources = page(() => import("./ResearchPages.js") as Promise<Record<"Sources", React.ComponentType>>, "Sources");
const AccessibilityHelp = page(() => import("./ResearchPages.js") as Promise<Record<"AccessibilityHelp", React.ComponentType>>, "AccessibilityHelp");
const FuturePanel = lazy(() => import("./FuturePanel.js").then((m) => ({ default: m.FuturePanel })));
const Lazy = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<ParticleLoader label="Loading…" />}>{children}</Suspense>;

/**
 * Explore panel (and its plain list alternative). With `withMap` it drives the 3D map through the shared map state: the filtered
 * and searched places, the selected place, and today/future (all mirrored in the URL so views survive reload and can be shared).
 */
export function PlaceList({ fetcher, withMap = false, makeSource = localSource }: { fetcher?: typeof fetch; withMap?: boolean; makeSource?: SourceFactory }) {
  const t = strings.en;
  const m = useMapState();
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

  // ---- the 3D map follows this panel (shared state) --------------------------------------------------------------------------
  const viewKey = view.features.map((f) => String(f.id)).join("|");
  useEffect(() => {
    if (!withMap || r === "loading" || r.status !== "ok") return;
    m.setView(view.features);
  }, [withMap, viewKey, r]);
  useEffect(() => () => { if (withMap) { m.setView(null); m.setSelectedId(null); } }, [withMap]);
  useEffect(() => { if (withMap) m.setSelectedId(selected); }, [withMap, selected]);
  // today/future and the year are mirrored in the URL on this page (?future=1&year=…)
  const urlFuture = params.get("future") === "1", urlYear = Number(params.get("year"));
  useEffect(() => {
    if (!withMap) return;
    if (urlFuture !== m.future) m.setFuture(urlFuture);
    if (urlFuture && Number.isInteger(urlYear) && urlYear > 2000 && urlYear !== m.year) m.setYear(urlYear);
  }, [withMap]);   // read once on arrival
  useEffect(() => {
    if (!withMap) return;
    // written once the year settles: a URL update per animated year would re-render every route on each step
    const id = window.setTimeout(() => {
      const p = new URLSearchParams(sanitizeQuery("P02", params));
      if (m.future) p.set("future", "1"); else p.delete("future");
      if (m.future && m.year !== 2034) p.set("year", String(m.year)); else p.delete("year");
      if (p.toString() !== new URLSearchParams(sanitizeQuery("P02", params)).toString()) setParams(p, { replace: true });
    }, 400);
    return () => clearTimeout(id);
  }, [withMap, m.future, m.year]);

  // Explore shortcuts: [ ] step through places, / search, Esc clears the selection (F/P/time live on the stage).
  const order = view.places.map((p) => p.id);
  const step = (d: number) => {
    if (!order.length) return;
    const i = selected ? order.indexOf(selected) : -1;
    setSelected(order[(i + d + order.length) % order.length]!);
  };
  const keyState = useRef({ step, clear: () => setSelected(null), selected });
  keyState.current = { step, clear: () => setSelected(null), selected };
  useEffect(() => {
    if (!withMap) return;
    const on = (e: KeyboardEvent) => {
      if (!plainKey(e) || document.querySelector("dialog[open]")) return;
      const k = keyState.current;
      if (e.key === "[") k.step(-1);
      else if (e.key === "]") k.step(1);
      else if (e.key === "/") { const el = document.getElementById("place-search"); if (!el) return; el.focus(); }
      else if (e.key === "Escape" && k.selected) k.clear();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [withMap]);
  const [panel, setPanel] = useState(true);
  const ok = r !== "loading" && r.status === "ok" && r.places.length > 0 ? r : null;

  return (
    <section aria-labelledby="h" className={withMap ? `explore-page${panel ? "" : " panel-closed"}${m.future ? " future-on" : ""}` : "list-page"}>
      <div className={withMap ? "float-panel glass hairline" : "list-head"}>
        <div className="panel-head">
          <h1 id="h">{t.listTitle}</h1>
          {withMap && <button type="button" className="icon-btn panel-toggle" aria-expanded={panel} aria-label={panel ? "Hide side panel" : "Show side panel"} data-tip={panel ? "Hide panel (full map)" : "Show panel"} onClick={() => setPanel(!panel)}><Icon name={panel ? "chevL" : "chevR"} size={16} /></button>}
        </div>
        <p className="lead">{t.listIntro}</p>
        {withMap && m.future && <Suspense fallback={<ParticleLoader label="Loading the forecast scene…" />}><FuturePanel /></Suspense>}
        <div role="status" aria-live="polite">
          {r === "loading" && t.loading}
          {r !== "loading" && r.status === "error" && <span>{t.errorPlaces}</span>}
          {r !== "loading" && r.status === "ok" && r.places.length === 0 && <span>{t.emptyPlaces}</span>}
        </div>
        {r !== "loading" && r.status === "error" && r.retryable && <button type="button" onClick={load}>{t.retry}</button>}
        {withMap && !m.future && ok && (
          <form className="search" role="search" aria-label="Search places" onSubmit={(e) => { e.preventDefault(); setQuery(typed); }}>
            <label htmlFor="place-search" className="visually-hidden">Search places</label>
            <span className="search-box">
              <Icon name="search" size={16} />
              <input id="place-search" type="search" placeholder="Search places  ( / )" value={typed} maxLength={100} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
            </span>
            <button type="submit" className="btn">Search</button>
            {q && <button type="button" onClick={() => { setTyped(""); setQuery(""); }}>Clear search</button>}
            <p role="status" aria-live="polite" className="search-status">
              {searchPending && "Searching…"}
              {searchFailed && "Search could not be completed. Clear the search to see all places."}
              {searchReady && (view.places.length === 0 ? `No places match “${q}”.` : `${view.places.length} ${view.places.length === 1 ? "place matches" : "places match"} “${q}”.`)}
            </p>
          </form>
        )}
        {withMap && !m.future && ok && (
          <div className="filters" role="group" aria-label="Filter places">
            <fieldset>
              <legend>Category</legend>
              {categories.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={filters.categories.includes(c)} onClick={() => setFilters({ ...filters, categories: toggle(filters.categories, c) })}><span className="chip-ico" style={{ color: categoryColor(c) }} aria-hidden="true"><Icon name={CATEGORY_ICON[c] ?? "info"} size={15} /></span>{categoryLabel(c)}</button>
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
              {isActive(filters) || q ? `Showing ${view.places.length} of ${ok.places.length} places.` : `Showing all ${ok.places.length} places.`}
              {view.places.length === 0 && !q && " No places match these filters."}
            </p>
          </div>
        )}
      </div>
      {withMap ? (
        <div className="sheet glass" data-state={sheet} ref={sheetRef} hidden={m.future}
          onKeyDown={(e) => { if (e.key === "Escape" && sheet !== "peek") { setSheet("peek"); } }}>
          <div className="sheet-bar" role="group" aria-label="Places panel size">
            <span id="sheet-title">Places and details</span>
            <button type="button" aria-expanded={sheet !== "peek"} aria-controls="sheet-body" onClick={() => setSheet(sheet === "full" ? "half" : "full")}>
              {sheet === "full" ? "Collapse" : "Expand"}
            </button>
            {sheet !== "peek" && <button type="button" onClick={() => setSheet("peek")}>Close</button>}
          </div>
          <div id="sheet-body" className="sheet-body" role="region" aria-labelledby="sheet-title">
            {ok && selected && (() => {
              const p = ok.places.find((x) => x.id === selected);
              return p ? (
                <SelectedPlace key={p.id} p={p} index={order.indexOf(p.id)} total={order.length} onStep={step} onClear={() => setSelected(null)} />
              ) : (
                <aside role="status">That place was not found. It may have been unpublished. <button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>
              );
            })()}
            {ok && (
              <ul className="place-cards">{view.places.map((p, i) => {
                const ph = photoFor(p.slug);
                return (
                  <li key={p.id} style={{ "--i": Math.min(i, 12), "--c": categoryColor(p.category) } as CSSProperties}>
                    <button type="button" className="place-card" aria-describedby={`pc-cat-${p.id}`} aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                      <span className="pc-thumb" aria-hidden="true">{ph ? <img src={ph.src} alt="" loading="lazy" /> : <Icon name={CATEGORY_ICON[p.category] ?? "info"} size={22} />}</span>
                      <span className="pc-name">{p.name}</span>
                      <span className="pc-go" aria-hidden="true"><Icon name="chevR" size={16} /></span>
                    </button>
                    {/* outside the button so its accessible name is exactly its visible text (WCAG 2.5.3) */}
                    <small className="pc-cat" id={`pc-cat-${p.id}`}><Icon name={CATEGORY_ICON[p.category] ?? "info"} size={13} />{categoryLabel(p.category)}</small>
                    {selected === p.id && <span role="status" className="visually-hidden"> - selected</span>}
                  </li>
                );
              })}</ul>
            )}
          </div>
        </div>
      ) : (
        ok && (
          <ul>{ok.places.map((p) => (
            <li key={p.id}>{p.name} <small>({p.category})</small></li>
          ))}</ul>
        )
      )}
    </section>
  );
}

/** The selected place (an info box, in Cesium's terms): photo, category, sourced notes, and stepping to the neighbours. */
function SelectedPlace({ p, index, total, onStep, onClear }: { p: PlaceSummary; index: number; total: number; onStep: (d: number) => void; onClear: () => void }) {
  const notes = landmarksFor(p.slug);
  const ph = photoFor(p.slug);
  return (
    <aside aria-label="Selected place" className="selected-place hairline" style={{ "--c": categoryColor(p.category) } as CSSProperties}>
      {ph && (
        <figure className="sp-photo">
          <img src={ph.src} alt={ph.alt} />
          <figcaption data-tip={`${ph.title} · ${ph.credit} · ${ph.licence}`}>{ph.title} · {ph.credit}, {ph.licence}</figcaption>
        </figure>
      )}
      <div className="sp-body">
        <p className="sp-cat"><Icon name={CATEGORY_ICON[p.category] ?? "info"} size={14} /> {categoryLabel(p.category)}</p>
        <h2>{p.name}</h2>
        {/* related landmarks are context (often nearby), not facts about this place: label them as such */}
        {notes.map((l) => <p key={l.id} className="sp-note"><span className="kicker">Related landmark</span> <b>{l.title}.</b> {l.why}</p>)}
        <div className="sp-actions">
          <Link className="btn" to={`/places/${p.slug}`}>Open profile <Icon name="arrowUR" size={15} /></Link>
          <span className="sp-step" role="group" aria-label="Step through places">
            <button type="button" className="icon-btn" aria-label="Previous place" data-tip="Previous place ([)" onClick={() => onStep(-1)}><Icon name="chevL" /></button>
            <span>{index + 1} / {total}</span>
            <button type="button" className="icon-btn" aria-label="Next place" data-tip="Next place (])" onClick={() => onStep(1)}><Icon name="chevR" /></button>
          </span>
          <button type="button" className="icon-btn" aria-label="Clear selection" data-tip="Clear selection (Esc)" onClick={onClear}><Icon name="close" /></button>
        </div>
        {notes.length > 0 && (
          <details className="more">
            <summary>Sourced notes on related landmarks</summary>
            {notes.map((l) => <LandmarkCard key={l.id} l={l} />)}
          </details>
        )}
      </div>
    </aside>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <section aria-labelledby="h" className="reader">
      <h1 id="h">{title}</h1>
      <p>{strings.en.building}</p>
    </section>
  );
}

const seen = new Set<string>();
const pageRoutes = publicRoutes.filter((r) => r.path !== "/" && r.path !== "/explore" && r.path !== "/places/:slug" && r.path !== "/places/:slug/panorama" && r.path !== "/places/:slug/then-and-now" && r.path !== "/stories/index" && r.path !== "/voices" && r.path !== "/insights" && !["/research/methodology", "/research/sources", "/accessibility"].includes(r.path) && !seen.has(r.path) && !!seen.add(r.path));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Lazy><Home /></Lazy>} />
        <Route path="/explore" element={<PlaceList withMap />} />
        <Route path="/places/:slug" element={<Lazy><PlaceProfile /></Lazy>} />
        <Route path="/places/:slug/panorama" element={<Lazy><PanoramaPage /></Lazy>} />
        <Route path="/places/:slug/then-and-now" element={<Lazy><ThenNowPage /></Lazy>} />
        <Route path="/voices" element={<Lazy><Voices /></Lazy>} />
        <Route path="/insights" element={<Lazy><Insights /></Lazy>} />
        <Route path="/forecasts" element={<Lazy><Forecasts /></Lazy>} />
        <Route path="/research/methodology" element={<Lazy><Methodology /></Lazy>} />
        <Route path="/research/sources" element={<Lazy><Sources /></Lazy>} />
        <Route path="/accessibility" element={<Lazy><AccessibilityHelp /></Lazy>} />
        {pageRoutes.map((r) => <Route key={r.path} path={r.path} element={<Pending title={r.title} />} />)}
        <Route path="/stories/index" element={<Lazy><ComparisonIndex /></Lazy>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
