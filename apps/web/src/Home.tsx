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
        <span aria-hidden="true">Makarba 360°</span>
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
        <HeroMedia media={hero} />
        <h1 id="home-h">{t.siteName}</h1>
        <p>{t.homeLead}</p>
        <p><Link className="cta" to="/explore">{t.homeCta}</Link></p>
      </section>

      <section aria-labelledby="about-h">
        <h2 id="about-h">About this atlas</h2>
        <p>Makarba 360° brings together mapped places, documented history and aggregated community findings about Makarba, Ahmedabad. Researchers collect interviews in person; this website only presents reviewed, privacy-safe results. Nothing here is submitted by the public.</p>
        <p><Link to="/research/methodology">Read the research methodology</Link></p>
      </section>

      <section aria-labelledby="landmarks-h">
        <h2 id="landmarks-h">Landmarks around Makarba</h2>
        <p>Short notes on the well-known landmarks near Makarba and why they matter, each with its source.</p>
        <Landmarks />
      </section>

      <section aria-labelledby="featured-h">
        <h2 id="featured-h">Featured places</h2>
        <div role="status" aria-live="polite">
          {r === "loading" && t.loading}
          {r !== "loading" && r.status === "error" && t.errorPlaces}
          {r !== "loading" && r.status === "ok" && featured.length === 0 && t.emptyPlaces}
        </div>
        {r !== "loading" && r.status === "ok" && r.synthetic && featured.length > 0 && <DataNote />}
        {featured.length > 0 && (
          <ul>{featured.map((p) => <li key={p.id}><Link to={`/explore?place=${p.id}`}>{p.name}</Link> <small>({p.category})</small></li>)}</ul>
        )}
      </section>

      <section aria-labelledby="then-h">
        <h2 id="then-h">Then &amp; Now</h2>
        <p>Where verified photographs and records exist, places will be compared across time with dates, sources and limits shown. Comparisons appear only when the evidence has been checked.</p>
        <p><Link to="/stories/index">Then &amp; Now</Link></p>
      </section>

      <section aria-labelledby="voices-h">
        <h2 id="voices-h">Community Voices</h2>
        <p>Reviewed accounts and aggregated survey findings appear here once collection has been approved. No findings or response counts are shown before then.</p>
        <p><Link to="/voices">Community Voices</Link> · <Link to="/insights">Urban Insights</Link></p>
      </section>
    </>
  );
}
