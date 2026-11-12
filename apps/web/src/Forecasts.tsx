import { useEffect, useState } from "react";

export interface Point { year: number; value: number; lo?: number; hi?: number }
export interface Series { id: string; label: string; theme: string; unit: string; history: Point[]; forecast: Point[] }
export interface ForecastDoc { generated: string; model: string; horizon: number; region: string; source: string; disclaimer: string; series: Series[] }

const fmt = (v: number | undefined) => v === undefined ? "–" : v.toLocaleString("en-IN", { maximumSignificantDigits: 4 });

const W = 560, H = 220, P = 32;

/** Pure SVG chart: history line, forecast line and 10-90% band. */
export function Chart({ s }: { s: Series }) {
  const all = [...s.history, ...s.forecast];
  const xs = all.map((p) => p.year), ys = all.flatMap((p) => [p.value, p.lo ?? p.value, p.hi ?? p.value]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const X = (v: number) => P + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const Y = (v: number) => H - P - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const line = (a: Point[]) => a.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const last = s.history[s.history.length - 1]!;
  const band = s.forecast.map((p) => `${X(p.year)},${Y(p.hi ?? p.value)}`).join(" L") + " L" + [...s.forecast].reverse().map((p) => `${X(p.year)},${Y(p.lo ?? p.value)}`).join(" L");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label}: ${s.history.length} years of history and a ${s.forecast.length}-year forecast`}>
      <path d={`M${band}Z`} className="band" />
      <path d={line(s.history)} className="hist" fill="none" />
      <path d={line([last, ...s.forecast])} className="fcst" fill="none" />
      <text x={P} y={H - 8}>{x0}</text><text x={W - P} y={H - 8} textAnchor="end">{x1}</text>
      <text x={4} y={P}>{fmt(y1)}</text><text x={4} y={H - P}>{fmt(y0)}</text>
    </svg>
  );
}

export function Forecasts({ url = "/forecasts.json" }: { url?: string }) {
  const [doc, setDoc] = useState<ForecastDoc | null>(null);
  const [err, setErr] = useState(false);
  const [theme, setTheme] = useState("all");
  useEffect(() => {
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject())).then(setDoc, () => setErr(true));
  }, [url]);
  if (err) return <p role="alert">Forecasts are unavailable. Generate them with <code>python ml/forecast.py</code>.</p>;
  if (!doc) return <p role="status">Loading forecasts…</p>;
  const themes = ["all", ...new Set(doc.series.map((s) => s.theme))];
  return (
    <section className="forecasts">
      <h1>Outlook: where the trends point</h1>
      <p className="notice"><strong>{doc.region}.</strong> {doc.disclaimer} Model: {doc.model}. Source: {doc.source}. Generated {doc.generated}.</p>
      <div role="group" aria-label="Filter by theme" className="chips">
        {themes.map((t) => <button key={t} type="button" aria-pressed={t === theme} onClick={() => setTheme(t)}>{t}</button>)}
      </div>
      <div className="cards">
        {doc.series.filter((s) => theme === "all" || s.theme === theme).map((s) => {
          const a = s.history[s.history.length - 1]!, b = s.forecast[s.forecast.length - 1]!;
          const d = a.value ? ((b.value - a.value) / Math.abs(a.value)) * 100 : 0;
          return (
            <article key={s.id} className="card">
              <h2>{s.label} <small>{s.theme}</small></h2>
              <Chart s={s} />
              <p>{a.year}: <b>{fmt(a.value)}</b> → {b.year}: <b>{fmt(b.value)}</b> {s.unit} ({d >= 0 ? "+" : ""}{d.toFixed(0)}%, 80% range {fmt(b.lo)}–{fmt(b.hi)})</p>
              <details><summary>Data table</summary>
                <table><thead><tr><th>Year</th><th>Forecast</th><th>Low</th><th>High</th></tr></thead>
                  <tbody>{s.forecast.map((p) => <tr key={p.year}><td>{p.year}</td><td>{p.value}</td><td>{p.lo}</td><td>{p.hi}</td></tr>)}</tbody></table>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
