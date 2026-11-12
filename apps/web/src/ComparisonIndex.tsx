import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlaces, type PlacesResult } from "./api.js";
import { DataNote } from "./DataNote.js";

/** Directory of published places; each place page checks its own current comparison evidence. */
export function ComparisonIndex({ fetcher }: { fetcher?: typeof fetch }) {
  const [result, setResult] = useState<PlacesResult | "loading">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult("loading");
    fetchPlaces(controller.signal, fetcher).then((value) => {
      if (!controller.signal.aborted) setResult(value);
    });
    return () => controller.abort();
  }, [fetcher, attempt]);

  return <section aria-labelledby="comparison-index-heading">
    <h1 id="comparison-index-heading">Then &amp; Now</h1>
    <p>Choose a place to explore its available comparisons. A place may not yet have a verified comparison.</p>
    {result === "loading" && <p role="status">Loading places…</p>}
    {result !== "loading" && result.status === "error" && <div role="status">
      <p>Places could not be loaded.</p>
      {result.retryable && <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
    </div>}
    {result !== "loading" && result.status === "ok" && (result.places.length === 0
      ? <p role="status">No places have been published yet.</p>
      : <>
        {result.synthetic && <DataNote />}
        <ul className="comparison-directory">{result.places.map((place) => <li key={place.id}>
          <Link to={`/places/${encodeURIComponent(place.slug)}/then-and-now`}>{place.name}</Link>
          <span>{place.category}</span>
        </li>)}</ul>
      </>)}
  </section>;
}
