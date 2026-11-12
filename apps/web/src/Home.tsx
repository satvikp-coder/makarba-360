import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlaces, type PlacesResult } from "./api.js";
import { strings } from "./i18n.js";
import { Landmarks } from "./landmarks.js";
import { DataNote } from "./DataNote.js";

/** An approved, rights-cleared hero image. None is configured yet, so the honest typographic fallback is shown. */
export interface HeroMediaInfo { src: string; alt: string; date: string; credit: string; licence: string }
export const APPROVED_HERO: HeroMediaInfo | null = null;
const SAFE_SRC = /^(\/|https:\/\/)/;

export function HeroMedia({ media = APPROVED_HERO }: { media?: HeroMediaInfo | null }) {
  const [failed, setFailed] = useState(false);
  if (!media || failed || !SAFE_SRC.test(media.src) || !media.credit || !media.date || !media.licence) {
    return (
      <div className="hero-fallback" role="img" aria-label="Typographic atlas panel. No approved photograph is available yet.">
        <span aria-hidden="true" className="hero-mark">360°</span>
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
