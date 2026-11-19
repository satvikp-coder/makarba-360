import { useMemo, useState } from "react";
import "./outlook.css";
import { Link } from "react-router-dom";
import { fmt, signals, upTo, type ForecastDoc, type Series, type Signal } from "./outlook.js";
import { ForecastChart } from "./ForecastChart.js";
import { motion } from "motion/react";
import { scenarioFor } from "./scenario.js";
import { useTween } from "./motion.js";
import { ParticleLoader } from "./Particles.js";
import { Icon, type IconName } from "./Icon.js";

export type { ForecastDoc, Series } from "./outlook.js";
import { DEFAULT_END_YEAR, useEndYear, useForecasts, YearSlider } from "./forecastData.js";
export { DEFAULT_END_YEAR, loadForecasts, useEndYear, useForecasts, YearSlider } from "./forecastData.js";

const THEME_ICON: Record<string, IconName> = { city: "building", economic: "coins", development: "bolt", social: "users", political: "shield", markets: "chart" };
const TAG_TIP: Record<string, string> = {
  improving: "Moving in the direction that is usually better for residents (e.g. falling unemployment).",
  worsening: "Moving in the direction that is usually worse for residents (e.g. rising pollution).",
  neutral: "Little change, or no clearly 'better' direction for this indicator.",
  accelerating: "The forecast changes faster per year than the last 10 years did.",
  slowing: "The forecast changes slower per year than the last 10 years did.",
  reversing: "The forecast turns the other way from the last 10 years.",
  steady: "The forecast continues at about the recent pace.",
  high: "The 80% range is narrow relative to the value.", medium: "The 80% range is moderate.", low: "The 80% range is wide: treat this forecast with caution.",
};
const THEMES = ["city", "economic", "development", "social", "political", "markets"] as const;

const W = 560, H = 200, P = 30;

/** A compact fan chart for one indicator (see ForecastChart): the last 30 years, the forecast to the end year and its 80% range. */
export function Chart({ s, endYear }: { s: Series; endYear: number }) {
  return <ForecastChart s={s} endYear={endYear} height={190} historyYears={30} />;
}

/** The featured forecast: one indicator large, with axes, a crosshair and the numbers that matter, chosen from a list. */
function FeaturedForecast({ sig, endYear }: { sig: Signal[]; endYear: number }) {
  const [id, setId] = useState(() => sig.find((x) => x.s.id === "WEATHER_AHD_HOTDAYS")?.s.id ?? sig[0]?.s.id ?? "");
  const x = sig.find((v) => v.s.id === id) ?? sig[0];
  if (!x) return null;
  const i = sig.indexOf(x), step = (d: number) => setId(sig[(i + d + sig.length) % sig.length]!.s.id);
  const endPt = x.to;
  const themes = [...new Set(sig.map((v) => v.s.theme))];
  return (
    <section className="featured panel" aria-labelledby="featured-h">
      <div className="featured-head">
        <div>
          <p className="eyebrow"><Icon name={THEME_ICON[x.s.theme] ?? "chart"} size={14} /> {x.s.theme} · featured forecast</p>
          <h2 id="featured-h">{x.s.label}</h2>
        </div>
        <div className="featured-pick">
          <button type="button" className="icon-btn" aria-label="Previous indicator" onClick={() => step(-1)}><Icon name="chevL" /></button>
          <label className="visually-hidden" htmlFor="featured-select">Indicator</label>
          <select id="featured-select" value={x.s.id} onChange={(e) => setId(e.target.value)}>
            {themes.map((t) => <optgroup key={t} label={t[0]!.toUpperCase() + t.slice(1)}>{sig.filter((v) => v.s.theme === t).map((v) => <option key={v.s.id} value={v.s.id}>{v.s.label}</option>)}</optgroup>)}
          </select>
          <button type="button" className="icon-btn" aria-label="Next indicator" onClick={() => step(1)}><Icon name="chevR" /></button>
        </div>
      </div>
      <ul className="featured-stats">
        <li><small>Latest ({Math.floor(x.from.year)})</small><b>{fmt(x.from.value)}</b><span>{x.s.unit}</span></li>
        <li><small>Forecast for {endYear}</small><b className="accent"><Tween value={endPt.value} digits={endPt.value < 100 ? 1 : 0} /></b><span>{x.s.unit}</span></li>
        <li><small>Change</small><b className={`delta-${x.verdict}`}>{x.pct === null ? fmt(x.change) : `${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(0)}%`}</b><span>{x.verdict}</span></li>
        <li><small>80% range in {endYear}</small><b>{fmt(endPt.lo)}–{fmt(endPt.hi)}</b><span>{x.confidence} confidence</span></li>
      </ul>
      <ForecastChart key={x.s.id} s={x.s} endYear={endYear} height={300} detailed />
      <p className="featured-note"><span className="fn-hist" /> recorded <span className="fn-fcst" /> TimesFM forecast <span className="fn-band" /> 80% range. Hover or use the arrow keys on the chart to read any year.</p>
    </section>
  );
}

function Tween({ value, digits = 0, suffix = "" }: { value: number; digits?: number; suffix?: string }) {
  const v = useTween(value);
  return <>{v.toFixed(digits)}{suffix}</>;
}

const VERDICT_ICON = { improving: "▲", worsening: "▼", neutral: "●" } as const;

function SignalCard({ x, endYear, i }: { x: Signal; endYear: number; i: number }) {
  // each card rises in as it scrolls into view (a little after its row neighbour), and only once
  return (
    <motion.article className={`card sig sig-${x.verdict}`} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      transition={{ duration: 0.6, delay: (i % 3) * 0.09, ease: [0.22, 1, 0.36, 1] }}>
      <div className="sig-head">
        <h3>{x.s.label}</h3>
        <span className="pill">{x.s.theme}</span>
      </div>
      <Chart s={x.s} endYear={endYear} />
      <p className="sig-num">
        <span className="yr">{Math.floor(x.from.year)}</span> <span>{fmt(x.from.value)}</span> <span aria-hidden="true">→</span> <span className="yr">{Math.floor(x.to.year)}</span> <b>{fmt(x.to.value)}</b> <small className="unit">{x.s.unit}</small>
        {x.pct !== null && <span className={`delta delta-${x.verdict}`}>{x.pct >= 0 ? "+" : ""}<Tween value={x.pct} />%</span>}
      </p>
      <p className="sig-tags">
        <span className={`tag tag-${x.verdict}`} tabIndex={0} data-tip={TAG_TIP[x.verdict]}><span aria-hidden="true">{VERDICT_ICON[x.verdict]} </span>{x.verdict}</span>
        <span className="tag" tabIndex={0} data-tip={TAG_TIP[x.momentum]}>{x.momentum}</span>
        <span className="tag" tabIndex={0} data-tip={TAG_TIP[x.confidence]}>{x.confidence} confidence</span>
      </p>
      <div className="sig-more">
        {x.implication && (
          <details className="more">
            <summary>Why it matters</summary>
            <p className="sig-impl">{x.implication} <small>(interpretation, not a finding)</small></p>
          </details>
        )}
        <details className="more">
          <summary>Data</summary>
          <table><caption className="visually-hidden">{x.s.label} forecast</caption><thead><tr><th scope="col">Year</th><th scope="col">Forecast</th><th scope="col">Low (10%)</th><th scope="col">High (90%)</th></tr></thead>
            <tbody>{upTo(x.s, endYear).forecast.filter((_, i, a) => a.length < 30 || i % 12 === 11 || i === a.length - 1).map((p) => <tr key={p.year}><td>{Math.floor(p.year)}</td><td>{fmt(p.value)}</td><td>{fmt(p.lo)}</td><td>{fmt(p.hi)}</td></tr>)}</tbody></table>
          <p><small>Series <code>{x.s.id}</code> · {x.s.history.length} observations to {Math.floor(x.from.year)} · forecast to {endYear}</small></p>
        </details>
      </div>
    </motion.article>
  );
}

export function TechDetails({ doc }: { doc: ForecastDoc }) {
  const counts = THEMES.map((t) => [t, doc.series.filter((s) => s.theme === t).length] as const).filter(([, n]) => n);
  return (
    <section className="panel tech" aria-labelledby="tech-h">
      <h2 id="tech-h">Model and data</h2>
      <dl className="tech-grid">
        <dt>Forecasting model</dt><dd>{doc.model === "google/timesfm-3.0-pytorch" ? <>Google <b>TimesFM 3.0</b> (time-series foundation model: stacked mixing transformer, 20 layers, model width 1280, patches of 32 in / 64 out), used zero-shot through the official <code>timesfm3</code> package. Weights are under the TimesFM Non-Commercial License v1.0: research use only, not production.</> : doc.model === "google/timesfm-2.5-200m-pytorch" ? <>Google <b>TimesFM 2.5</b> (200M parameters, Apache-2.0), used zero-shot.</> : doc.model}</dd>
        <dt>Settings</dt><dd>Point forecast plus nine quantiles (10th–90th percentile band shown); each series forecast on its own history (univariate); runs on Apple-silicon GPU (MPS) when available.</dd>
        <dt>Horizon</dt><dd>Every series is forecast once to {doc.maxYear}. TimesFM decodes the whole horizon in one pass, so the end-year slider shows an exact prefix of the same forecast, not a re-run.</dd>
        <dt>Data</dt><dd>{doc.source}{(doc as ForecastDoc & { marketsSource?: string }).marketsSource ? `; ${(doc as ForecastDoc & { marketsSource?: string }).marketsSource}` : ""}. {doc.series.length} series: {counts.map(([t, n]) => `${n} ${t}`).join(", ")}. Region: {doc.region}. Generated {doc.generated}.</dd>
        <dt>Preparation</dt><dd>Annual World Bank values, annual Ahmedabad heat and rain indicators from daily weather, and monthly Ahmedabad air-quality/market values (the city air-quality record ends mid-2020, during the COVID lockdown, so its starting point is low); missing periods linearly interpolated; series with fewer than 15 points dropped; percentage-of-population forecasts bounded to 0–100 and counts to ≥0.</dd>
        <dt>Signals</dt><dd>Verdict compares the change with the indicator's desirable direction (moves under 2% are neutral). Momentum compares the forecast's yearly slope with the last 10 years. Confidence is the 80% band width relative to the level.</dd>
        <dt>3D scenario</dt><dd>Fixed, stated mappings: GDP per capita → corridor heights and redevelopment; urban share → residential density; renewables → rooftop solar; PM2.5 → haze; incomes and population → traffic. Illustrative only.</dd>
        <dt>AI insights</dt><dd>The highlights and briefings on the map are AI-generated from these forecasts and labelled so. Each highlight is a structured item (icon, tone, map anchor, indicators) checked against fixed lists; the numbers beside it come from the forecast file. They are interpretations for discussion and can be wrong.</dd>
        <dt>Limits</dt><dd>National India series, not Makarba measurements. Statistical extrapolation cannot foresee policy changes, shocks or elections. Kaggle data is not included (needs the owner's API key and licence review).</dd>
      </dl>
      <p>Regenerate: <code>python ml/forecast.py</code> (see <code>ml/README.md</code>).</p>
    </section>
  );
}

type Tab = "signals" | "model";

export function Forecasts({ fetcher }: { fetcher?: typeof fetch } = {}) {
  const { doc, err } = useForecasts(fetcher);
  const [year, setYear] = useEndYear(doc?.maxYear ?? 2050);
  const [theme, setTheme] = useState("all");
  const [tab, setTab] = useState<Tab>("signals");
  const sig = useMemo(() => (doc ? signals(doc, year) : []), [doc, year]);
  const scen = useMemo(() => (doc ? scenarioFor(doc, year) : null), [doc, year]);
  if (err) return <p role="alert">Forecasts are unavailable. Generate them with <code>python ml/forecast.py</code>.</p>;
  if (!doc) return <ParticleLoader label="Loading forecasts…" />;
  const themes = THEMES.filter((t) => sig.some((x) => x.s.theme === t));
  const shown = sig.filter((x) => theme === "all" || x.s.theme === theme);
  const tabs: [Tab, string][] = [["signals", "Signals"], ["model", "Model & data"]];
  return (
    <section className="outlook" aria-labelledby="outlook-h">
      <div className="outlook-top">
        <div>
          <p className="eyebrow">Outlook · {doc.region}</p>
          <h1 id="outlook-h">Where the trends point by {year}</h1>
          <p className="notice">{doc.disclaimer}</p>
        </div>
        <YearSlider year={year} onChange={setYear} max={doc.maxYear} />
      </div>

      {sig.length > 0 && <FeaturedForecast sig={sig} endYear={year} />}

      <ul className="scoreboard" aria-label="Indicators by theme">
        {themes.map((t) => {
          const xs = sig.filter((x) => x.s.theme === t);
          const up = xs.filter((x) => x.verdict === "improving").length, down = xs.filter((x) => x.verdict === "worsening").length, flat = xs.length - up - down;
          return (
            <li key={t}>
              <button type="button" className="sb" aria-pressed={theme === t} onClick={() => { setTheme(theme === t ? "all" : t); setTab("signals"); }}
                data-tip={`${xs.length} ${t} indicators by ${year}: ${up} moving in a good direction, ${down} in a bad one, ${flat} flat or without a clear good direction. Click to filter.`}>
                <span className="sb-label"><Icon name={THEME_ICON[t] ?? "chart"} size={16} /> {t}</span>
                <span className="sb-val"><b>{up}</b><small> of {xs.length} improving</small></span>
                <span className="sb-bar" aria-hidden="true">
                  <span className="g" style={{ flexGrow: up }} /><span className="n" style={{ flexGrow: flat }} /><span className="r" style={{ flexGrow: down }} />
                </span>
                <span className="sb-sub">{down ? `${down} worsening` : "none worsening"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {scen && (
        <p className="scenario-cta">
          <Link className="cta" to={`/explore?future=1${year === DEFAULT_END_YEAR ? "" : `&year=${year}`}`}>See {year} on the 3D map</Link>
          <span>{scen.changes.length} visible changes: {scen.changes.map((c) => c.title.toLowerCase()).join(", ")}.</span>
        </p>
      )}

      <div role="tablist" aria-label="Outlook views" className="tabs">
        {tabs.map(([id, label]) => <button key={id} role="tab" type="button" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}
          onKeyDown={(e) => { const i = tabs.findIndex(([x]) => x === id); const n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (n) { const next = tabs[(i + n + tabs.length) % tabs.length]![0]; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{label}</button>)}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel" key={tab}>
        {tab === "signals" && (
          <>
            {theme !== "all" && <p className="filter-note">Showing {theme} indicators. <button type="button" onClick={() => setTheme("all")}>Show all themes</button></p>}
            <div className="cards">{shown.map((x, i) => <SignalCard key={x.s.id} x={x} endYear={year} i={i} />)}</div>
          </>
        )}
        {tab === "model" && <TechDetails doc={doc} />}
      </div>
    </section>
  );
}
