import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchHistory, fetchPlaces, type HistoryResult, type PlaceSummary } from "./api.js";
import { NotFound } from "./NotFound.js";
import { ThenNowSection } from "./ThenNowView.js";
import { strings } from "./i18n.js";

type S =
  | { slug: string; status: "loading" } | { slug: string; status: "missing" } | { slug: string; status: "error" }
  | { slug: string; status: "ok"; place: PlaceSummary; history: HistoryResult };

/** P06: all verified comparisons for one place. History is fetched fresh (no-store), so a withdrawn pair disappears on the next load. */
export function ThenNowPage({ fetcher }: { fetcher?: typeof fetch }) {
  const { slug = "" } = useParams();
  const [s, setS] = useState<S>({ slug, status: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    fetchPlaces(ac.signal, fetcher).then(async (r) => {
      if (ac.signal.aborted) return;
      if (r.status === "error") return setS({ slug, status: "error" });
      const place = r.places.find((p) => p.slug === slug);
      if (!place) return setS({ slug, status: "missing" });
      const history = await fetchHistory(slug, ac.signal, fetcher);
      if (!ac.signal.aborted) setS({ slug, status: "ok", place, history });
    });
    return () => ac.abort();
  }, [slug, fetcher]);
  useEffect(() => { document.title = s.slug === slug && s.status === "ok" ? `Then & Now: ${s.place.name} – ${strings.en.siteName}` : `${strings.en.siteName}`; }, [s, slug]);
  if (s.slug !== slug || s.status === "loading") return <p role="status">{strings.en.loading}</p>;
  if (s.status === "missing") return <NotFound />;
  if (s.status === "error") return <section><h1>{strings.en.errorPlaces}</h1><p>Please try again later.</p></section>;
  const pairs = s.history.status === "ok" ? s.history.data.comparisonPairs : [];
  const sources = s.history.status === "ok" ? s.history.data.sources : [];
  return (
    <article aria-labelledby="tn-h">
      <p><Link to={`/places/${slug}`}>← {s.place.name}</Link></p>
      <h1 id="tn-h">Then &amp; Now: {s.place.name}</h1>
      {s.history.status === "error" && <p role="status">History could not be loaded. Please try again later.</p>}
      <ThenNowSection pairs={pairs} sources={sources} fetcher={fetcher} />
      <p>Only comparisons whose dates, sources and images have been checked are shown. If a comparison is withdrawn it disappears from this page the next time it loads.</p>
      <p><Link to={`/places/${slug}`}>Back to the place page</Link></p>
    </article>
  );
}
