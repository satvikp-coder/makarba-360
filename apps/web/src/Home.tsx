import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlaces, type PlacesResult } from "./api.js";
import { strings } from "./i18n.js";
import { Landmarks } from "./landmarks.js";
import { DataNote } from "./DataNote.js";
import { Particles } from "./Particles.js";
import { DEFAULT_END_YEAR, useForecasts } from "./Forecasts.js";
import { fmt, signal } from "./outlook.js";
import { useTween } from "./motion.js";

/** An approved, rights-cleared hero image. None is configured yet, so the honest typographic fallback is shown. */
export interface HeroMediaInfo { src: string; alt: string; date: string; credit: string; licence: string }
export const APPROVED_HERO: HeroMediaInfo | null = null;
const SAFE_SRC = /^(\/|https:\/\/)/;

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

export function Home({ fetcher, hero }: { fetcher?: typeof fetch; hero?: HeroMediaInfo | null }) {
  const t = strings.en;
  const [r, setR] = useState<PlacesResult | "loading">("loading");
  useEffect(() => {
    const ac = new AbortController();
    fetchPlaces(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher]);
  const featured = r !== "loading" && r.status === "ok" ? r.places.slice(0, 4) : [];
  return (
    <>
      <section aria-labelledby="home-h" className="hero">
        <div className="hero-text">
          <p className="eyebrow">Ahmedabad · Gujarat</p>
          <h1 id="home-h">{t.siteName}</h1>
          <p className="lead">{t.homeLead}</p>
          <p className="hero-actions">
            <Link className="cta" to="/explore">{t.homeCta}</Link>
            <Link className="cta cta-ghost" to="/forecasts">See the outlook</Link>
          </p>
        </div>
        <HeroMedia media={hero} />
      </section>

      <OutlookStrip />

      <div className="tiles">
        <section aria-labelledby="about-h" className="tile">
          <h2 id="about-h">About this atlas</h2>
          <p>Mapped places, documented history and aggregated community findings about Makarba. Researchers collect interviews in person; this site only shows reviewed, privacy-safe results. Nothing here is submitted by the public.</p>
          <p><Link to="/research/methodology">Read the research methodology</Link></p>
        </section>

        <section aria-labelledby="featured-h" className="tile">
          <h2 id="featured-h">Featured places</h2>
          <div role="status" aria-live="polite">
            {r === "loading" && t.loading}
            {r !== "loading" && r.status === "error" && t.errorPlaces}
            {r !== "loading" && r.status === "ok" && featured.length === 0 && t.emptyPlaces}
          </div>
          {r !== "loading" && r.status === "ok" && r.synthetic && featured.length > 0 && <DataNote />}
          {featured.length > 0 && (
            <ul className="link-list">{featured.map((p) => <li key={p.id}><Link to={`/explore?place=${p.id}`}>{p.name}</Link> <small>({p.category})</small></li>)}</ul>
          )}
        </section>

        <section aria-labelledby="then-h" className="tile">
          <h2 id="then-h">Then &amp; Now</h2>
          <p>Where verified photographs and records exist, places are compared across time with dates, sources and limits shown.</p>
          <p><Link to="/stories/index">Then &amp; Now</Link></p>
        </section>

        <section aria-labelledby="voices-h" className="tile">
          <h2 id="voices-h">Community Voices</h2>
          <p>Reviewed accounts and aggregated survey findings appear once collection has been approved. No findings are shown before then.</p>
          <p><Link to="/voices">Community Voices</Link> · <Link to="/insights">Urban Insights</Link></p>
        </section>
      </div>

      <section aria-labelledby="landmarks-h">
        <h2 id="landmarks-h">Landmarks around Makarba</h2>
        <p className="lead">Short notes on the well-known landmarks near Makarba and why they matter, each with its source.</p>
        <Landmarks />
      </section>
    </>
  );
}

const KPIS = ["NY.GDP.PCAP.CD", "SP.URB.TOTL.IN.ZS", "KAGGLE_AHD_PM2.5", "IT.NET.USER.ZS"];

function Kpi({ label, from, to, unit, pct, verdict }: { label: string; from: number; to: number; unit: string; pct: number | null; verdict: string }) {
  const v = useTween(to, 1100);
  return (
    <li className={`kpi kpi-${verdict}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-val">{fmt(Number(v.toPrecision(4)))}</span>
      <span className="kpi-sub">{unit} · now {fmt(from)}{pct !== null ? ` · ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%` : ""}</span>
    </li>
  );
}

/** Four headline forecasts for the default end year; the full set lives in Outlook. Hidden if the forecast file is absent. */
function OutlookStrip() {
  const { doc } = useForecasts();
  if (!doc) return null;
  const sig = KPIS.map((id) => doc.series.find((s) => s.id === id)).flatMap((s) => (s ? [signal(s, DEFAULT_END_YEAR)!] : []));
  if (!sig.length) return null;
  return (
    <section aria-labelledby="kpi-h" className="kpi-wrap">
      <div className="kpi-head">
        <h2 id="kpi-h">Outlook for {DEFAULT_END_YEAR}</h2>
        <Link to="/forecasts">All {doc.series.length} indicators, AI briefing and model details</Link>
      </div>
      <ul className="kpis">{sig.map((x) => <Kpi key={x.s.id} label={x.s.label} from={x.from.value} to={x.to.value} unit={x.s.unit} pct={x.pct} verdict={x.verdict} />)}</ul>
      <p className="kpi-note"><small>TimesFM forecasts of national and Ahmedabad data; not Makarba measurements.</small></p>
    </section>
  );
}
