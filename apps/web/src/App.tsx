import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { mainNavigation, publicRoutes, type NavGroup } from "@makarba/public-ia";
import { fetchPlaces, type PlacesResult } from "./api.js";
import { MapView, type MapStatus } from "./map/MapView.js";
import { LANGUAGES, strings, type Lang } from "./i18n.js";

const NAV_TARGET: Record<Exclude<NavGroup, "footer">, string> = {
  Explore: "/explore", "Then & Now": "/stories/index", "Community Voices": "/voices", "Urban Insights": "/insights", Research: "/research/methodology",
};
const FOOTER = publicRoutes.filter((r) => r.nav === "footer");

function Layout() {
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang];
  const loc = useLocation();
  useEffect(() => { document.documentElement.lang = lang === "en" || !LANGUAGES.find((l) => l.code === lang)?.available ? "en" : lang; }, [lang]);
  useEffect(() => { document.title = `${titleFor(loc.pathname)} – ${t.siteName}`; }, [loc.pathname, t.siteName]);
  return (
    <>
      <a className="skip" href="#main">{t.skip}</a>
      <header>
        <Link to="/" className="brand">{t.siteName}</Link>
        <nav aria-label={t.navLabel}>
          <ul>
            {mainNavigation.map((g) => (
              <li key={g}><NavLink to={NAV_TARGET[g as Exclude<NavGroup, "footer">]}>{g}</NavLink></li>
            ))}
          </ul>
        </nav>
        <label>
          {t.language}{" "}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code} disabled={!l.available}>{l.available ? l.label : `${l.label} (${t.languagePending})`}</option>)}
          </select>
        </label>
      </header>
      <main id="main" tabIndex={-1}><Outlet /></main>
      <footer>
        <nav aria-label={t.footerLabel}>
          <ul>{FOOTER.map((r) => <li key={r.id}><Link to={r.path}>{r.title}</Link></li>)}</ul>
        </nav>
      </footer>
    </>
  );
}

function titleFor(path: string): string {
  const route = publicRoutes.find((r) => !r.path.includes(":") && r.path === path);
  return route?.title ?? "Makarba 360°";
}

function Home() {
  const t = strings.en;
  return (
    <section aria-labelledby="h">
      <h1 id="h">{t.siteName}</h1>
      <p>{t.homeLead}</p>
      <p><Link to="/explore">{t.homeCta}</Link></p>
    </section>
  );
}

/** List alternative for the map (P02-P04): same published places, no map or WebGL needed. */
export function PlaceList({ fetcher, withMap = false }: { fetcher?: typeof fetch; withMap?: boolean }) {
  const t = strings.en;
  const [selected, setSelected] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [r, setR] = useState<PlacesResult | "loading">("loading");
  const load = useCallback(() => {
    const ac = new AbortController();
    setR("loading");
    fetchPlaces(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher]);
  useEffect(() => load(), [load]);
  return (
    <section aria-labelledby="h">
      <h1 id="h">{t.listTitle}</h1>
      <p>{t.listIntro}</p>
      <div role="status" aria-live="polite">
        {r === "loading" && t.loading}
        {r !== "loading" && r.status === "error" && <span>{t.errorPlaces}</span>}
        {r !== "loading" && r.status === "ok" && r.places.length === 0 && <span>{t.emptyPlaces}</span>}
      </div>
      {r !== "loading" && r.status === "error" && r.retryable && <button type="button" onClick={load}>{t.retry}</button>}
      {withMap && r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <MapView features={r.features} sourceAttribution={r.synthetic ? "Demonstration place data (synthetic)" : "Place data: Makarba 360 published snapshot"} selectedId={selected} onSelect={setSelected} onStatus={setMapStatus} />
      )}
      {withMap && mapStatus === "unavailable" && <p><small>Map unavailable - the list is the full alternative.</small></p>}
      {r !== "loading" && r.status === "ok" && r.places.length > 0 && (
        <>
          {r.synthetic && <p><strong>{t.synthetic}</strong></p>}
          <ul>{r.places.map((p) => (
            <li key={p.id}>
              {withMap ? <button type="button" aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)}>{p.name}</button> : p.name}{" "}
              <small>({p.category})</small>
              {selected === p.id && <span role="status"> - selected</span>}
            </li>
          ))}</ul>
        </>
      )}
    </section>
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

function NotFound() {
  return <section><h1>{strings.en.notFound}</h1><p><Link to="/">{strings.en.siteName}</Link></p></section>;
}

const seen = new Set<string>();
const pageRoutes = publicRoutes.filter((r) => r.path !== "/" && r.path !== "/explore" && !seen.has(r.path) && !!seen.add(r.path));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/explore" element={<PlaceList withMap />} />
        {pageRoutes.map((r) => <Route key={r.path} path={r.path} element={<Pending title={r.title} />} />)}
        <Route path="/stories/index" element={<Pending title="Then & Now" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
