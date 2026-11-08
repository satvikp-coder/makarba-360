import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchHistory, fetchMedia, fetchPlaces, formatDated, type HistoryResult, type MediaData, type PlaceSummary } from "./api.js";
import { NotFound } from "./NotFound.js";
import { ThenNowSection } from "./ThenNowView.js";
import { Gallery } from "./Gallery.js";
import { Panorama } from "./Panorama.js";
import { strings } from "./i18n.js";

type PlaceState = { slug: string; status: "loading" } | { slug: string; status: "missing" } | { slug: string; status: "error" } | { slug: string; status: "ok"; place: PlaceSummary; synthetic: boolean };
const GEOMETRY: Record<string, string> = { Point: "a point", LineString: "a line (street or route)", Polygon: "an area", MultiPoint: "several points", MultiLineString: "several lines", MultiPolygon: "several areas" };
const SAFE_URL = /^https:\/\//;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

export function PlaceProfile({ fetcher }: { fetcher?: typeof fetch }) {
  const { slug = "" } = useParams();
  const [place, setPlace] = useState<PlaceState>({ slug, status: "loading" });
  const [hist, setHist] = useState<{ slug: string; r: HistoryResult } | null>(null);
  const [media, setMedia] = useState<{ slug: string; items: (MediaData | "unavailable")[] } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    // state is keyed by slug so content for a previous place can never be shown for the next one
    fetchPlaces(ac.signal, fetcher).then((r) => {
      if (ac.signal.aborted) return;
      if (r.status === "error") return setPlace({ slug, status: "error" });
      const p = r.places.find((x) => x.slug === slug);
      setPlace(p ? { slug, status: "ok", place: p, synthetic: r.synthetic } : { slug, status: "missing" });
    });
    return () => ac.abort();
  }, [slug, fetcher]);

  const ok = place.slug === slug && place.status === "ok" ? place : null;
  useEffect(() => {
    if (!ok) return;
    const ac = new AbortController();
    fetchHistory(slug, ac.signal, fetcher).then((r) => { if (!ac.signal.aborted) setHist({ slug, r }); });
    Promise.all(ok.place.mediaIds.map((id) => fetchMedia(id, ac.signal, fetcher))).then((rs) => {
      if (!ac.signal.aborted) setMedia({ slug, items: rs.map((m) => (m.status === "ok" ? m.data : "unavailable")) });
    });
    return () => ac.abort();
  }, [ok?.place.id, slug, fetcher]);

  useEffect(() => { document.title = ok ? `${ok.place.name} – ${strings.en.siteName}` : `${strings.en.notFound} – ${strings.en.siteName}`; }, [ok]);

  if (place.slug !== slug || place.status === "loading") return <p role="status">{strings.en.loading}</p>;
  if (place.status === "missing") return <NotFound />;
  if (place.status === "error") return <section><h1>{strings.en.errorPlaces}</h1><p>Please try again later.</p></section>;
  const p = place.place;
  const h = hist?.slug === slug ? hist.r : null;
  const items = media?.slug === slug ? media.items : null;
  const isPano = (m: MediaData | "unavailable"): m is MediaData => m !== "unavailable" && m.format === "equirectangular";
  const panos = (items ?? []).filter(isPano);
  const flat = (items ?? []).filter((m) => !isPano(m));

  return (
    <article aria-labelledby="place-h">
      <p><Link to="/explore">← All places</Link></p>
      <h1 id="place-h">{p.name}</h1>
      <p>Category: {p.category}. {place.synthetic && <strong>{strings.en.synthetic}</strong>}</p>
      <p>No approved description has been published yet.</p>
      <p>Mapped as {GEOMETRY[p.geometryType] ?? "a mapped feature"}. <Link to={`/explore?place=${p.id}`}>Show on the map</Link></p>

      <Section id="history-h" title="History">
        {!h && <p role="status">{strings.en.loading}</p>}
        {h?.status === "error" && <p role="status">History could not be loaded.</p>}
        {(h?.status === "missing" || (h?.status === "ok" && h.data.events.length === 0)) && <p>No verified history has been published yet.</p>}
        {h?.status === "ok" && h.data.events.length > 0 && (
          <ul>{h.data.events.map((e) => {
            const src = h.data.sources.find((s) => s.id === e.sourceId);
            return <li key={e.id}><strong>{formatDated(e.date)}</strong> – {e.text} <small>({e.evidenceType}; source: {src ? src.citation : "source not listed"})</small></li>;
          })}</ul>
        )}
      </Section>

      <Section id="media-h" title="Photographs">
        {!items && <p role="status">{strings.en.loading}</p>}
        {items && (flat.length > 0 || panos.length === 0) && <Gallery items={flat} />}
        {panos.length > 0 && (
          <>
            <h3>360° view</h3>
            {panos.map((m) => <Panorama key={m.id} media={m} />)}
          </>
        )}
      </Section>

      {h?.status === "ok" && h.data.comparisonPairs.length > 0 && (
        <ThenNowSection pairs={h.data.comparisonPairs} sources={h.data.sources} fetcher={fetcher} />
      )}

      <Section id="findings-h" title="Community findings">
        <p>No findings are published for this place yet. When approved, they appear here with their sample size and limits; small groups are hidden, never shown as zero.</p>
      </Section>

      <Section id="sources-h" title="Sources">
        {h?.status === "ok" && h.data.sources.length > 0 ? (
          <ul>{h.data.sources.map((s) => <li key={s.id}>{s.citation} <small>(licence: {s.licence}; {s.verificationState})</small>{SAFE_URL.test(s.url) && <> <a href={s.url} rel="noopener noreferrer">link</a></>}</li>)}</ul>
        ) : <p>No sources listed yet.</p>}
      </Section>
    </article>
  );
}
