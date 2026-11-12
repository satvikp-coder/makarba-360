import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fetchPlaces, type PlacesResult } from "./api.js";
import { strings } from "./i18n.js";
import { Landmarks } from "./landmarks.js";
import { Particles } from "./Particles.js";
import { DEFAULT_END_YEAR, useForecasts } from "./forecastData.js";
import { fmt, signal } from "./outlook.js";
import { useTween } from "./motion.js";
import { Icon, type IconName } from "./Icon.js";
import { LIBRARY } from "./Shell.js";
import { CATEGORY_ICON, categoryColor, categoryLabel } from "./categories.js";
import { photoFor } from "./placePhotos.js";
import { useAi } from "./aiStore.js";
import { Orb } from "./Orb.js";

/** An approved, rights-cleared hero image. None is configured yet, so the typographic particle panel is shown. */
export interface HeroMediaInfo { src: string; alt: string; date: string; credit: string; licence: string }
export const APPROVED_HERO: HeroMediaInfo | null = null;
// Same-origin paths or https only; protocol-relative "//host" URLs are refused (from #227).
const SAFE_SRC = /^(\/(?!\/)|https:\/\/)/;

export function HeroMedia({ media = APPROVED_HERO }: { media?: HeroMediaInfo | null }) {
  const [failed, setFailed] = useState(false);
  if (!media || failed || !SAFE_SRC.test(media.src) || !media.credit || !media.date || !media.licence) {
    return (
      <div className="hero-fallback" role="img" aria-label="Typographic atlas panel. No approved photograph is available yet.">
        <Particles text="360°" />
      </div>
    );
  }
  return (
    <figure>
      <img src={media.src} alt={media.alt} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      <figcaption>{media.date} · {media.credit} · {media.licence}</figcaption>
    </figure>
  );
}

const KPIS: { id: string; icon: IconName; label: string }[] = [
  { id: "NY.GDP.PCAP.CD", icon: "coins", label: "GDP per person (India)" }, { id: "SP.URB.TOTL.IN.ZS", icon: "building", label: "Living in cities (India)" },
  { id: "WEATHER_AHD_HOTDAYS", icon: "thermo", label: "Days ≥ 40 °C (Ahmedabad)" }, { id: "KAGGLE_AHD_PM2.5", icon: "haze", label: "PM2.5 air (Ahmedabad)" },
];

function Kpi({ icon, label, from, to, unit, pct, verdict }: { icon: IconName; label: string; from: number; to: number; unit: string; pct: number | null; verdict: string }) {
  const v = useTween(to, 1100);
  return (
    <li className={`kpi kpi-${verdict}`}>
      <span className="kpi-label"><Icon name={icon} size={16} /> {label}</span>
      <span className="kpi-val">{fmt(Number(v.toPrecision(4)))}</span>
      <span className="kpi-sub">{unit} · now {fmt(from)}{pct !== null ? ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%` : ""}</span>
    </li>
  );
}

/** Headline forecasts for the default end year plus the AI headline; hidden if the forecast file is absent. */
function OutlookStrip() {
  const { doc } = useForecasts();
  const ai = useAi(doc, DEFAULT_END_YEAR);
  if (!doc) return null;
  const sig = KPIS.flatMap(({ id, icon, label }) => { const s = doc.series.find((x) => x.id === id); const g = s && signal(s, DEFAULT_END_YEAR); return g ? [{ g, icon, label }] : []; });
  if (!sig.length) return null;
  return (
    <section aria-labelledby="kpi-h" className="kpi-wrap">
      <div className="kpi-head">
        <h2 id="kpi-h">Outlook for {DEFAULT_END_YEAR}</h2>
        <Link to="/forecasts">All {doc.series.length} indicators <Icon name="arrowUR" size={14} /></Link>
      </div>
      <ul className="kpis">{sig.map(({ g, icon, label }) => <Kpi key={g.s.id} icon={icon} label={label} from={g.from.value} to={g.to.value} unit={g.s.unit} pct={g.pct} verdict={g.verdict} />)}</ul>
      {(ai.highlights?.length || ai.status === "running") && (
        <div className="ai-strip">
          {ai.highlights?.length ? (
            <>
              <p className="ai-badge"><Icon name="spark" size={13} /> AI-generated</p>
              {ai.headline && <p className="ai-headline">{ai.headline}</p>}
              <ul className="ai-mini">{ai.highlights.slice(0, 3).map((h) => <li key={h.id} className={`tone-${h.tone}`}><Icon name={h.icon} size={16} /> {h.title}</li>)}</ul>
              <Link to="/explore?future=1">See them on the 3D map <Icon name="arrowUR" size={14} /></Link>
            </>
          ) : <p role="status" className="ai-thinking"><Orb state="thinking" size={20} /> Generating AI insights in the background…</p>}
        </div>
      )}
      <p className="kpi-note"><small>TimesFM forecasts of national and Ahmedabad data; not Makarba measurements.</small></p>
    </section>
  );
}

export function Home({ fetcher, hero }: { fetcher?: typeof fetch; hero?: HeroMediaInfo | null }) {
  const t = strings.en;
  const [r, setR] = useState<PlacesResult | "loading">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setR("loading");
    fetchPlaces(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher, attempt]);
  const featured = r !== "loading" && r.status === "ok" ? r.places.slice(0, 4) : [];
  return (
    <div className="home-page">
      <section aria-labelledby="home-h" className="hero">
        <div className="hero-text">
          <p className="eyebrow">Ahmedabad · Gujarat</p>
          <h1 id="home-h">{t.siteName}</h1>
          <p className="lead">{t.homeLead}</p>
          <p className="hero-actions">
            <Link className="cta" to="/explore"><Icon name="map" />{t.homeCta}</Link>
            <Link className="cta cta-ghost" to="/forecasts"><Icon name="trend" />See the outlook</Link>
          </p>
          <p className="hero-keys"><kbd>?</kbd> keyboard shortcuts · <kbd>,</kbd> display settings</p>
        </div>
        <HeroMedia media={hero} />
      </section>

      <OutlookStrip />

      <section aria-labelledby="featured-h" className="home-featured">
        <div className="kpi-head">
          <h2 id="featured-h">Featured places</h2>
          <Link to="/explore">All places on the map <Icon name="arrowUR" size={14} /></Link>
        </div>
        <div role="status" aria-live="polite">
          {r === "loading" && t.loading}
          {r !== "loading" && r.status === "error" && t.errorPlaces}
          {r !== "loading" && r.status === "ok" && featured.length === 0 && t.emptyPlaces}
        </div>
        {r !== "loading" && r.status === "error" && r.retryable && <button type="button" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button>}
        {featured.length > 0 && (
          <ul className="featured-cards">{featured.map((p) => {
            const ph = photoFor(p.slug);
            return (
              <li key={p.id} style={{ "--c": categoryColor(p.category) } as CSSProperties}>
                {ph && <img src={ph.src} alt="" loading="lazy" />}
                <span className="fc-cat"><Icon name={CATEGORY_ICON[p.category] ?? "info"} size={14} /> {categoryLabel(p.category)}</span>
                <Link to={`/explore?place=${p.id}`}>{p.name}</Link>
              </li>
            );
          })}</ul>
        )}
      </section>

      <div className="tiles library">
        <section aria-labelledby="about-h" className="tile">
          <span className="tile-ico" aria-hidden="true"><Icon name="info" size={22} /></span>
          <h2 id="about-h">About this atlas</h2>
          <p>Mapped places, documented history and community findings about Makarba. Researchers interview people in person; this site shows only reviewed, privacy-safe results.</p>
          <p><Link to="/research/methodology">Read the research methodology</Link></p>
        </section>
        {LIBRARY.map((l) => (
          <section key={l.to} aria-labelledby={`lib-${l.icon}`} className="tile">
            <span className="tile-ico" aria-hidden="true"><Icon name={l.icon} size={22} /></span>
            <h2 id={`lib-${l.icon}`}>{l.label}</h2>
            <p>{l.blurb}</p>
            <p><Link to={l.to}>{l.label}</Link></p>
          </section>
        ))}
      </div>

      <section aria-labelledby="landmarks-h">
        <h2 id="landmarks-h">Landmarks around Makarba</h2>
        <p className="lead">Short notes on the well-known landmarks near Makarba and why they matter, each with its source.</p>
        <Landmarks />
      </section>
    </div>
  );
}
