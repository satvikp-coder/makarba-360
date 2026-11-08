import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchMedia, fetchPlaces, type MediaData, type PlaceSummary } from "./api.js";
import { Gallery } from "./Gallery.js";
import { NotFound } from "./NotFound.js";
import { Panorama } from "./Panorama.js";
import { strings } from "./i18n.js";

type State =
  | { slug: string; status: "loading" } | { slug: string; status: "missing" } | { slug: string; status: "error" }
  | { slug: string; status: "ok"; place: PlaceSummary; media: (MediaData | "unavailable")[] };

/** P07: the place's 360° view, or an honest explanation of why there is none. Never implies coverage that is not published. */
export function PanoramaPage({ fetcher }: { fetcher?: typeof fetch }) {
  const { slug = "" } = useParams();
  const [s, setS] = useState<State>({ slug, status: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    fetchPlaces(ac.signal, fetcher).then(async (r) => {
      if (ac.signal.aborted) return;
      if (r.status === "error") return setS({ slug, status: "error" });
      const place = r.places.find((p) => p.slug === slug);
      if (!place) return setS({ slug, status: "missing" });
      const ms = await Promise.all(place.mediaIds.map((id) => fetchMedia(id, ac.signal, fetcher)));
      if (!ac.signal.aborted) setS({ slug, status: "ok", place, media: ms.map((m) => (m.status === "ok" ? m.data : "unavailable")) });
    });
    return () => ac.abort();
  }, [slug, fetcher]);

  useEffect(() => { document.title = s.slug === slug && s.status === "ok" ? `360° view: ${s.place.name} – ${strings.en.siteName}` : `${strings.en.siteName}`; }, [s, slug]);
  if (s.slug !== slug || s.status === "loading") return <p role="status">{strings.en.loading}</p>;
  if (s.status === "missing") return <NotFound />;
  if (s.status === "error") return <section><h1>{strings.en.errorPlaces}</h1><p>Please try again later.</p></section>;
  const panos = s.media.filter((m): m is MediaData => m !== "unavailable" && m.format === "equirectangular");
  const stills = s.media.filter((m) => m === "unavailable" || m.format !== "equirectangular");
  return (
    <article aria-labelledby="pano-h">
      <p><Link to={`/places/${slug}`}>← {s.place.name}</Link></p>
      <h1 id="pano-h">360° view: {s.place.name}</h1>
      {panos.length > 0 ? panos.map((m) => <Panorama key={m.id} media={m} />) : (
        <section aria-labelledby="no-pano-h">
          <h2 id="no-pano-h">No 360° view for this place</h2>
          <p>No approved 360° photograph has been published for this place. Street-level coverage is not available everywhere, and none is promised.</p>
          {stills.length > 0 && <><h3>Approved photographs</h3><Gallery items={stills} /></>}
          <p><Link to={`/places/${slug}`}>Back to the place page</Link></p>
        </section>
      )}
    </article>
  );
}
