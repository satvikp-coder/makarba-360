import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ForecastDoc } from "./outlook.js";

/**
 * Forecast data access shared by the Overview, Explore and Outlook. Kept apart from the Outlook page so that page (charts,
 * AI insights, model details) can be loaded only when visited.
 */
export const DEFAULT_END_YEAR = 2034;
const THIS_YEAR = new Date().getFullYear();

/** Forecast file plus the optional, locally generated markets file. One fetch per page load, shared by Outlook and the map. */
let cache: Promise<ForecastDoc> | null = null;
export function loadForecasts(fetcher: typeof fetch = fetch, url = "/forecasts.json"): Promise<ForecastDoc> {
  if (fetcher !== fetch) return load(fetcher, url);
  return (cache ??= load(fetcher, url).catch((e) => { cache = null; throw e; }));
}
async function load(fetcher: typeof fetch, url: string): Promise<ForecastDoc> {
  const r = await fetcher(url);
  if (!r.ok) throw new Error("missing");
  const doc = (await r.json()) as ForecastDoc;
  try {
    const m = await fetcher(url.replace("forecasts.json", "markets.json"));
    if (m.ok && (m.headers?.get?.("content-type") ?? "json").includes("json")) {
      const md = (await m.json()) as ForecastDoc;
      return { ...doc, series: [...doc.series, ...md.series], marketsSource: md.source } as ForecastDoc;
    }
  } catch { /* markets are optional */ }
  return doc;
}

export function useForecasts(fetcher?: typeof fetch, enabled = true) {
  const [doc, setDoc] = useState<ForecastDoc | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadForecasts(fetcher).then((d) => live && setDoc(d), () => live && setErr(true));
    return () => { live = false; };
  }, [fetcher, enabled]);
  return { doc, err };
}

/** End year lives in the URL (?year=) so the map and Outlook agree and a view can be shared. */
export function useEndYear(max = 2050): [number, (y: number) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("year"));
  const year = Number.isInteger(raw) && raw > THIS_YEAR && raw <= max ? raw : Math.min(DEFAULT_END_YEAR, max);
  const set = (y: number) => { const p = new URLSearchParams(params); if (y === DEFAULT_END_YEAR) p.delete("year"); else p.set("year", String(y)); setParams(p, { replace: true }); };
  return [year, set];
}

export function YearSlider({ year, onChange, max }: { year: number; onChange: (y: number) => void; max: number }) {
  return (
    <div className="year-slider">
      <label htmlFor="end-year">Forecast to <output htmlFor="end-year" className="year-out">{year}</output></label>
      <input id="end-year" type="range" min={THIS_YEAR + 1} max={max} step={1} value={year} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="year-range" aria-hidden="true"><span>{THIS_YEAR + 1}</span><span>{max}</span></span>
    </div>
  );
}

