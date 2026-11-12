import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Forecasts, useEndYear, useForecasts, YearSlider } from "./Forecasts.js";
import { scenarioFor, type Scenario } from "./scenario.js";
import { ParticleLoader } from "./Particles.js";
import { Icon } from "./Icon.js";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import { sanitizeQuery } from "@makarba/public-ia";
import { publicRoutes } from "@makarba/public-ia";
import { fetchPlaces, type PlaceSummary, type PlacesResult } from "./api.js";
import { CATEGORY_ICON, categoryColor, categoryLabel } from "./categories.js";
import { Layout, plainKey } from "./Shell.js";
import { photoFor } from "./placePhotos.js";
import { ensureAi, useAi, type Highlight } from "./aiStore.js";
import { fmt, signal } from "./outlook.js";
import { ANCHORS } from "./scenario.js";
import { Orb } from "./Orb.js";
import type { ForecastDoc } from "./outlook.js";
import { LandmarkCard, landmarksFor } from "./landmarks.js";
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
import { strings } from "./i18n.js";
import { cleanQuery, localSource, type SourceFactory } from "./searchSource.js";
import { applyFilters, isActive, LAYERS, parseFilters, toggle, writeFilters, type Filters } from "./filters.js";

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
  // "Future" panel: the same TimesFM forecasts as Outlook, shown as an illustrative scene on the 3D map.
  const future = withMap && params.get("future") === "1";
  const setFuture = (on: boolean) => { const p = new URLSearchParams(sanitizeQuery("P02", params)); if (on) p.set("future", "1"); else { p.delete("future"); p.delete("year"); } setParams(p); };
  const fc = useForecasts(undefined, future);
  const [year, setYear] = useEndYear(fc.doc?.maxYear ?? 2050);
  // "Play" grows the city year by year from today to the chosen year; the map's height transitions make it continuous.
  const [playYear, setPlayYear] = useState<number | null>(null);
  useEffect(() => {
    if (playYear === null) return;
    if (playYear >= year) { const t = setTimeout(() => setPlayYear(null), 600); return () => clearTimeout(t); }
    const t = setTimeout(() => setPlayYear(playYear + 1), 420);
    return () => clearTimeout(t);
  }, [playYear, year]);
  useEffect(() => { if (!future) setPlayYear(null); }, [future]);
  const shownYear = playYear ?? year;
  const [focusId, setFocusId] = useState<string | null>(null);
  const scenario: Scenario | null = future && fc.doc ? scenarioFor(fc.doc, shownYear) : null;
  const [panel, setPanel] = useState(true);
  // Explore shortcuts: [ ] step through places, / search, F today/future, P play, Esc clears the selection.
  const order = view.places.map((p) => p.id);
  const step = (d: number) => {
    if (!order.length) return;
    const i = selected ? order.indexOf(selected) : -1;
    setSelected(order[(i + d + order.length) % order.length]!);
  };
  const keyState = useRef({ step, future, setFuture, onPlay: () => setPlayYear((y) => (y === null ? new Date().getFullYear() + 1 : null)), clear: () => setSelected(null), selected });
  keyState.current = { step, future, setFuture, onPlay: () => setPlayYear((y) => (y === null ? new Date().getFullYear() + 1 : null)), clear: () => setSelected(null), selected };
  useEffect(() => {
    if (!withMap) return;
    const on = (e: KeyboardEvent) => {
      if (!plainKey(e) || document.querySelector("dialog[open]")) return;
      const k = keyState.current;
      if (e.key === "[") k.step(-1);
      else if (e.key === "]") k.step(1);
      else if (e.key === "/") { const el = document.getElementById("place-search"); if (!el) return; el.focus(); }
      else if (e.key === "f" || e.key === "F") k.setFuture(!k.future);
      else if ((e.key === "p" || e.key === "P") && k.future) k.onPlay();
      else if (e.key === "Escape" && k.selected) k.clear();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [withMap]);
  // Highlights for the map and panel: AI-generated when available, otherwise the rule-based scenario changes.
  const ai = useAi(future ? fc.doc : null, year);
  // generate highlights for a newly chosen year once the slider settles (cached years return at once)
  useEffect(() => {
    if (!future || !fc.doc || playYear !== null || navigator.webdriver) return;
    const t = window.setTimeout(() => { void ensureAi(fc.doc!, year, { background: true }); }, 1500);
    return () => clearTimeout(t);
  }, [future, fc.doc, year, playYear]);
  const aiHighlights = future && ai.highlights?.length ? ai.highlights : null;
  const mapHighlights = scenario ? (aiHighlights ? aiHighlights.map((h) => ({ id: h.id, title: h.title, at: ANCHORS[h.anchor].at, tone: h.tone })) : scenario.changes.map((c) => ({ id: c.id, title: c.title, at: c.at, tone: "mixed" as const }))) : null;
  return (
    <section aria-labelledby="h" className={withMap ? `explore-page${panel ? "" : " panel-closed"}` : undefined}>
      <h1 id="h">{t.listTitle}</h1>
      <p className="lead">{t.listIntro}</p>
      {withMap && (
        <div role="group" aria-label="Map mode" className="seg-tabs">
          <button type="button" aria-pressed={!future} onClick={() => setFuture(false)} data-tip="The city as it is (F)"><Icon name="map" size={16} />Today</button>
          <button type="button" aria-pressed={future} onClick={() => setFuture(true)} data-tip="An illustrative future from the forecasts (F)"><Icon name="trend" size={16} />Future scenario</button>
        </div>
      )}
      {future && <FuturePanel scenario={scenario} doc={fc.doc} ai={ai} aiHighlights={aiHighlights} error={fc.err} year={year} setYear={(y) => { setPlayYear(null); setYear(y); }} max={fc.doc?.maxYear ?? 2050}
        focusId={focusId} playing={playYear !== null} onPlay={() => setPlayYear(playYear === null ? new Date().getFullYear() + 1 : null)} />}
      <div role="status" aria-live="polite">
        {r === "loading" && t.loading}
        {r !== "loading" && r.status === "error" && <span>{t.errorPlaces}</span>}
        {r !== "loading" && r.status === "ok" && r.places.length === 0 && <span>{t.emptyPlaces}</span>}
      </div>
      {r !== "loading" && r.status === "error" && r.retryable && <button type="button" onClick={load}>{t.retry}</button>}
      {withMap && !future && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
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
      {withMap && !future && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
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
            {isActive(filters) || q ? `Showing ${view.places.length} of ${r.places.length} places.` : `Showing all ${r.places.length} places.`}
            {view.places.length === 0 && !q && " No places match these filters."}
          </p>
        </div>
      )}
      {withMap ? (
        <div className="explore">
          <div className="explore-map">
            <button type="button" className="panel-toggle tb" aria-expanded={panel} aria-label={panel ? "Hide side panel" : "Show side panel"} data-tip={panel ? "Hide side panel (full-width map)" : "Show side panel"} onClick={() => setPanel(!panel)}><Icon name={panel ? "chevL" : "chevR"} /></button>
      {withMap && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <Suspense fallback={<p role="status">Loading map…</p>}><MapView features={view.features} sourceAttribution={r.synthetic ? "Places: Makarba 360 demo dataset" : "Place data: Makarba 360 published snapshot"} selectedId={selected} onSelect={setSelected} onStatus={setMapStatus} scenario={scenario} highlights={mapHighlights} onFocusChange={setFocusId} /></Suspense>
      )}
          </div>
          <div className="sheet" data-state={sheet} ref={sheetRef} hidden={future}
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
          <SelectedPlace key={p.id} p={p} index={order.indexOf(p.id)} total={order.length} onStep={step} onClear={() => setSelected(null)} />
        ) : (
          <aside role="status">That place was not found. It may have been unpublished. <button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>
        );
      })()}
      {withMap && mapStatus === "unavailable" && <p><small>Map unavailable - the list is the full alternative.</small></p>}
      {r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <>
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

const TONE_LABEL = { positive: "Could improve life", negative: "Could make life harder", mixed: "Mixed effects" } as const;

/** Forecast numbers for a highlight's indicators, read from the data (never from model text). */
function Metrics({ doc, ids, year }: { doc: ForecastDoc | null; ids: string[]; year: number }) {
  if (!doc) return null;
  const chips = ids.flatMap((id) => { const s = doc.series.find((x) => x.id === id); const g = s && signal(s, year); return g ? [g] : []; });
  return chips.length ? <ul className="metric-chips">{chips.map((g) => <li key={g.s.id} data-tip={`${g.s.label}: ${g.s.unit}`}><span>{g.s.label}</span> <b>{fmt(g.from.value)} → {fmt(g.to.value)}</b></li>)}</ul> : null;
}

/**
 * The future scene, explained. Highlights are GENERATIVE: when a local or cloud model is available, it chooses what matters, the icons,
 * tone and map anchors (from fixed lists), and the panel renders whatever it returns. Without a model, the rule-based changes are shown.
 * Numbers match the callouts on the map.
 */
function FuturePanel({ scenario, doc, ai, aiHighlights, error, year, setYear, max, playing, onPlay, focusId }: { scenario: Scenario | null; doc: ForecastDoc | null; ai: ReturnType<typeof useAi>; aiHighlights: Highlight[] | null; error: boolean; year: number; setYear: (y: number) => void; max: number; playing: boolean; onPlay: () => void; focusId: string | null }) {
  if (error) return <p role="alert">Forecasts are unavailable. Generate them with <code>./run.sh forecast</code>.</p>;
  if (!scenario) return <ParticleLoader label="Loading the forecast scene…" />;
  const thinking = ai.status === "running" && !aiHighlights;
  return (
    <section className="future-panel" aria-labelledby="future-h">
      <h2 id="future-h">Makarba in {scenario.year}</h2>
      <p className="lead">{aiHighlights && ai.headline ? ai.headline : "How the city could look if today's trends continue."}</p>
      <div className="future-controls">
        <button type="button" className="btn play" aria-pressed={playing} onClick={onPlay} data-tip="Watch the city change year by year (P)"><Icon name={playing ? "pause" : "play"} />{playing ? "Pause" : `Play to ${year}`}</button>
        <YearSlider year={year} onChange={setYear} max={max} />
      </div>
      <div className="hl-head">
        <h3>{aiHighlights ? "Highlights" : "What changes on the map"}</h3>
        {aiHighlights && <span className="ai-badge" data-tip={`Chosen and written by ${ai.model ?? "a language model"} from the forecasts. Can be wrong.`}><Icon name="spark" size={13} /> AI-generated</span>}
        {thinking && <span className="ai-thinking" role="status"><Orb state="thinking" size={18} /> Generating highlights…</span>}
      </div>
      {aiHighlights ? (
        <ol className="changes gen">
          {aiHighlights.map((h, i) => (
            <li key={h.id} style={{ "--i": i } as CSSProperties} className={`chg tone-${h.tone}${focusId === h.id ? " on" : ""}`} aria-current={focusId === h.id ? "true" : undefined}>
              <span className="chg-n" aria-hidden="true"><Icon name={h.icon} size={16} /></span>
              <div>
                <h3><span className="visually-hidden">{i + 1}. </span>{h.title}</h3>
                <p>{h.body}</p>
                <p className="chg-tone"><span className="tone-dot" aria-hidden="true" />{TONE_LABEL[h.tone]} · {ANCHORS[h.anchor].label}</p>
                <Metrics doc={doc} ids={h.indicators} year={scenario.year} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="changes">
          {scenario.changes.map((c, i) => (
            <li key={c.id} style={{ "--i": i } as CSSProperties} className={`chg chg-${c.id}${focusId === c.id ? " on" : ""}`} aria-current={focusId === c.id ? "true" : undefined}>
              <span className="chg-n" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{c.title}</h3>
                <p>{c.effect}</p>
                <p className="chg-because" data-tip="The forecast this change is based on">{c.because}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {aiHighlights && (
        <details className="more">
          <summary>What the 3D scene shows</summary>
          <ul className="scene-rules">{scenario.changes.map((c) => <li key={c.id}><b>{c.title}.</b> {c.effect} <small>{c.because}</small></li>)}</ul>
        </details>
      )}
      <p className="hint"><Icon name="info" size={14} /> Illustrative: each change follows national or Ahmedabad forecasts. Not a plan.</p>
      <p><Link to={`/forecasts${year === 2034 ? "" : `?year=${year}`}`}>All indicators and the AI briefing →</Link></p>
    </section>
  );
}

/** The selected place: photo, category, sourced notes in brief, and stepping to the neighbours in the list. */
function SelectedPlace({ p, index, total, onStep, onClear }: { p: PlaceSummary; index: number; total: number; onStep: (d: number) => void; onClear: () => void }) {
  const notes = landmarksFor(p.slug);
  const ph = photoFor(p.slug);
  return (
    <aside aria-label="Selected place" className="selected-place" style={{ "--c": categoryColor(p.category) } as CSSProperties}>
      {ph && (
        <figure className="sp-photo">
          <img src={ph.src} alt={ph.alt} />
          <figcaption data-tip={`${ph.title} · ${ph.credit} · ${ph.licence}`}>{ph.representative ? "Representative photo · " : ""}{ph.credit}, {ph.licence}</figcaption>
        </figure>
      )}
      <div className="sp-body">
        <p className="sp-cat"><Icon name={CATEGORY_ICON[p.category] ?? "info"} size={14} /> {categoryLabel(p.category)}</p>
        <h2>{p.name}</h2>
        {notes.map((l) => <p key={l.id} className="sp-note">{l.facts[0]?.text}</p>)}
        <div className="sp-actions">
          <Link className="btn" to={`/places/${p.slug}`}>Open profile <Icon name="arrowUR" size={15} /></Link>
          <span className="sp-step" role="group" aria-label="Step through places">
            <button type="button" className="tb" aria-label="Previous place" data-tip="Previous place ([)" onClick={() => onStep(-1)}><Icon name="chevL" /></button>
            <span>{index + 1} / {total}</span>
            <button type="button" className="tb" aria-label="Next place" data-tip="Next place (])" onClick={() => onStep(1)}><Icon name="chevR" /></button>
          </span>
          <button type="button" className="tb" aria-label="Clear selection" data-tip="Clear selection (Esc)" onClick={onClear}><Icon name="close" /></button>
        </div>
        {notes.length > 0 && (
          <details className="more">
            <summary>Sourced notes</summary>
            {notes.map((l) => <LandmarkCard key={l.id} l={l} />)}
          </details>
        )}
      </div>
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
