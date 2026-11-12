import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fmt, signals, summaryPrompt, upTo, type ForecastDoc, type Series, type Signal } from "./outlook.js";
import { scenarioFor } from "./scenario.js";
import { useTween } from "./motion.js";
import { ParticleLoader } from "./Particles.js";
import { Icon, type IconName } from "./Icon.js";

export type { ForecastDoc, Series } from "./outlook.js";

export const DEFAULT_END_YEAR = 2034;
const THIS_YEAR = new Date().getFullYear();
const THEME_ICON: Record<string, IconName> = { city: "layers", economic: "chart", development: "cube", social: "info", political: "route", markets: "spark" };
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

const W = 560, H = 200, P = 30;

/** SVG chart: history, forecast to the end year and its 10-90% band. The forecast re-draws itself when the year changes. */
export function Chart({ s, endYear }: { s: Series; endYear: number }) {
  const f = upTo(s, endYear).forecast;
  const hist = s.history;
  const all = [...hist, ...f];
  const xs = all.map((p) => p.year), ys = all.flatMap((p) => [p.value, p.lo ?? p.value, p.hi ?? p.value]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const X = (v: number) => P + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const Y = (v: number) => H - P - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const line = (a: { year: number; value: number }[]) => a.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const last = hist[hist.length - 1]!;
  const band = f.length ? `M${f.map((p) => `${X(p.year).toFixed(1)},${Y(p.hi ?? p.value).toFixed(1)}`).join(" L")} L${[...f].reverse().map((p) => `${X(p.year).toFixed(1)},${Y(p.lo ?? p.value).toFixed(1)}`).join(" L")}Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label}: history to ${Math.floor(last.year)} and forecast to ${endYear}`}>
      <line x1={X(last.year)} x2={X(last.year)} y1={P / 2} y2={H - P} className="now-line" />
      <path key={`b${endYear}`} d={band} className="band" />
      <path d={line(hist)} className="hist" fill="none" />
      <path key={`f${endYear}`} d={line([last, ...f])} className="fcst" fill="none" pathLength={1} />
      <text x={P} y={H - 8}>{Math.floor(x0)}</text><text x={W - P} y={H - 8} textAnchor="end">{endYear}</text>
      <text x={4} y={P - 6}>{fmt(y1)}</text><text x={4} y={H - P + 12}>{fmt(y0)}</text>
    </svg>
  );
}

function Tween({ value, digits = 0, suffix = "" }: { value: number; digits?: number; suffix?: string }) {
  const v = useTween(value);
  return <>{v.toFixed(digits)}{suffix}</>;
}

const VERDICT_ICON = { improving: "▲", worsening: "▼", neutral: "●" } as const;

function SignalCard({ x, endYear }: { x: Signal; endYear: number }) {
  return (
    <article className={`card sig sig-${x.verdict}`}>
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
      <details className="more">
        <summary>Why it matters · data</summary>
        {x.implication && <p className="sig-impl"><span className="visually-hidden">Possible implication: </span>{x.implication} <small>(interpretation, not a finding)</small></p>}
        <table><caption className="visually-hidden">{x.s.label} forecast</caption><thead><tr><th scope="col">Year</th><th scope="col">Forecast</th><th scope="col">Low (10%)</th><th scope="col">High (90%)</th></tr></thead>
          <tbody>{upTo(x.s, endYear).forecast.filter((_, i, a) => a.length < 30 || i % 12 === 11 || i === a.length - 1).map((p) => <tr key={p.year}><td>{Math.floor(p.year)}</td><td>{fmt(p.value)}</td><td>{fmt(p.lo)}</td><td>{fmt(p.hi)}</td></tr>)}</tbody></table>
        <p><small>Source series <code>{x.s.id}</code> · last actual {Math.floor(x.from.year)}</small></p>
      </details>
    </article>
  );
}

/** Very small, safe markdown subset for the model's text: **bold** and "- " bullets. Text nodes only, never HTML. */
function Briefing({ text }: { text: string }) {
  const bold = (l: string) => l.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part.replace(/\*/g, "")));
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>); list = []; };
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (/^[-*•]\s+/.test(l)) { list.push(l.replace(/^[-*•]\s+/, "")); continue; }
    flush();
    if (!l) continue;
    const h = l.replace(/^#+\s*/, "");
    blocks.push(/^#+\s/.test(l) || /^\*\*[^*]+\*\*:?$/.test(l) ? <h4 key={blocks.length}>{h.replace(/\*\*/g, "").replace(/:$/, "")}</h4> : <p key={blocks.length}>{bold(l)}</p>);
  }
  flush();
  return <div className="briefing-text">{blocks}</div>;
}

type Provider = "ollama" | "groq";
const PROVIDERS: Record<Provider, { label: string; note: string; list: string; models: (d: unknown) => string[] }> = {
  ollama: { label: "On-device (Ollama)", note: "Runs on this computer; nothing leaves it.", list: "/ollama/api/tags",
    models: (d) => ((d as { models?: { name: string }[] }).models ?? []).map((m) => m.name) },
  groq: { label: "Groq (cloud)", note: "Sends the forecast numbers below (no personal data) to Groq's servers.", list: "/groq/models",
    models: (d) => ((d as { data?: { id: string }[] }).data ?? []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed/i.test(id)).sort() },
};

/** Streams text from Ollama (NDJSON) or Groq (OpenAI-style SSE) into onText. */
async function stream(provider: Provider, model: string, prompt: string, signal: AbortSignal, onText: (t: string) => void) {
  const r = provider === "ollama"
    ? await fetch("/ollama/api/generate", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, stream: true, options: { temperature: 0.3 } }) })
    : await fetch("/groq/chat/completions", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, stream: true, temperature: 0.3, messages: [{ role: "user", content: prompt }] }) });
  if (!r.ok || !r.body) throw new Error(String(r.status));
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const raw of lines) {
      const l = provider === "groq" ? raw.replace(/^data:\s*/, "").trim() : raw.trim();
      if (!l || l === "[DONE]") continue;
      const j = JSON.parse(l) as { response?: string; choices?: { delta?: { content?: string } }[] };
      const t = provider === "ollama" ? j.response : j.choices?.[0]?.delta?.content;
      if (t) onText(t);
    }
  }
}

/** AI briefing from the forecast numbers: on-device (Ollama) or Groq cloud. Always labelled as AI-generated. */
export function AiBriefing({ sig, endYear, region }: { sig: Signal[]; endYear: number; region: string }) {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState("");
  const [text, setText] = useState("");
  const [meta, setMeta] = useState("");
  const [state, setState] = useState<"idle" | "running" | "done" | "error" | "offline">("idle");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    setModels(null); setModel(""); setState("idle");
    const p = PROVIDERS[provider];
    fetch(p.list).then((r) => (r.ok ? r.json() : Promise.reject())).then(
      (d: unknown) => { if (!live) return; const n = p.models(d); setModels(n); setModel(n.find((m) => /llama-3\.3-70b|gpt-oss-120b|gemma/i.test(m)) ?? n[0] ?? ""); if (!n.length) setState("offline"); },
      () => { if (live) { setModels([]); setState("offline"); } });
    return () => { live = false; abort.current?.abort(); };
  }, [provider]);
  const run = async () => {
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setText(""); setState("running");
    try {
      await stream(provider, model, summaryPrompt(sig, endYear, region), ac.signal, (t) => setText((x) => x + t));
      setMeta(`${model} · ${PROVIDERS[provider].label} · ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · end year ${endYear}`);
      setState("done");
    } catch { if (!ac.signal.aborted) setState("error"); }
  };
  return (
    <section className="panel briefing" aria-labelledby="ai-h">
      <h2 id="ai-h"><Icon name="spark" /> AI briefing: what could this mean for Makarba?</h2>
      <div role="radiogroup" aria-label="AI provider" className="seg-tabs">
        {(Object.keys(PROVIDERS) as Provider[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={provider === k} aria-pressed={provider === k} data-tip={PROVIDERS[k].note} onClick={() => setProvider(k)}>{PROVIDERS[k].label}</button>
        ))}
      </div>
      <p className="hint"><Icon name="info" size={14} /> {PROVIDERS[provider].note}</p>
      {state === "offline" ? (
        provider === "ollama"
          ? <p role="status">No local model found. Install <a href="https://ollama.com" rel="noreferrer">Ollama</a>, run <code>ollama pull gemma3n</code>, keep it open, then reload.</p>
          : <p role="status">Groq is not configured. Put <code>GROQ_API_KEY=…</code> in <code>apps/web/.env.local</code> (git-ignored) and restart <code>./run.sh</code>. The key stays on the dev server.</p>
      ) : (
        <div className="ai-controls">
          <label>Model <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models?.length}>{(models ?? []).map((m) => <option key={m}>{m}</option>)}</select></label>
          <button type="button" className="btn" onClick={run} disabled={!model || state === "running"}><Icon name="spark" /> {state === "done" || state === "error" ? `Regenerate for ${endYear}` : `Generate briefing for ${endYear}`}</button>
          {state === "running" && <button type="button" onClick={() => { abort.current?.abort(); setState(text ? "done" : "idle"); }}>Stop</button>}
        </div>
      )}
      {state === "running" && !text && <ParticleLoader label="The model is reading the forecasts…" />}
      {state === "error" && <p role="alert">The model did not answer. {provider === "ollama" ? "Check that Ollama is running." : "Check the Groq key and model."}</p>}
      {text && (
        <div className="ai-output" aria-live="polite" aria-busy={state === "running"}>
          <p className="ai-badge"><Icon name="spark" size={14} /> AI-generated insight</p>
          <Briefing text={text} />
          <p className="ai-foot"><small>AI-generated from TimesFM forecasts{meta ? ` (${meta})` : ""}. It can be wrong or overconfident; national trends are not Makarba measurements. Check the Signals tab for the numbers.</small></p>
        </div>
      )}
    </section>
  );
}

export function TechDetails({ doc }: { doc: ForecastDoc }) {
  const counts = THEMES.map((t) => [t, doc.series.filter((s) => s.theme === t).length] as const).filter(([, n]) => n);
  return (
    <section className="panel tech" aria-labelledby="tech-h">
      <h2 id="tech-h">Model and data</h2>
      <dl className="tech-grid">
        <dt>Forecasting model</dt><dd>{doc.model === "google/timesfm-2.5-200m-pytorch" ? <>Google <b>TimesFM 2.5</b> (200M parameters, decoder-only time-series foundation model, PyTorch), used zero-shot: no training on this data.</> : doc.model}</dd>
        <dt>Settings</dt><dd>Up to 128 past points of context; point forecast plus a continuous quantile head (10th–90th percentile band shown); input normalisation and flip invariance on; quantile crossing fixed.</dd>
        <dt>Horizon</dt><dd>Every series is forecast once to {doc.maxYear}. TimesFM decodes the whole horizon in one pass, so the end-year slider shows an exact prefix of the same forecast, not a re-run.</dd>
        <dt>Data</dt><dd>{doc.source}{(doc as ForecastDoc & { marketsSource?: string }).marketsSource ? `; ${(doc as ForecastDoc & { marketsSource?: string }).marketsSource}` : ""}. {doc.series.length} series: {counts.map(([t, n]) => `${n} ${t}`).join(", ")}. Region: {doc.region}. Generated {doc.generated}.</dd>
        <dt>Preparation</dt><dd>Annual World Bank values and monthly Ahmedabad/market values (the city air-quality record ends mid-2020, during the COVID lockdown, so its starting point is low); missing periods linearly interpolated; series with fewer than 15 points dropped; percentage-of-population forecasts bounded to 0–100 and counts to ≥0.</dd>
        <dt>Signals</dt><dd>Verdict compares the change with the indicator's desirable direction (moves under 2% are neutral). Momentum compares the forecast's yearly slope with the last 10 years. Confidence is the 80% band width relative to the level.</dd>
        <dt>3D scenario</dt><dd>Fixed, stated mappings: GDP per capita → corridor heights and redevelopment; urban share → residential density; renewables → rooftop solar; PM2.5 → haze; incomes and population → traffic. Illustrative only.</dd>
        <dt>AI briefing</dt><dd>Labelled "AI-generated". On-device through Ollama (<code>/ollama</code> proxy) or Groq cloud (<code>/groq</code> proxy, key from <code>GROQ_API_KEY</code>, never sent to the browser). The prompt contains only the numbers shown here. Apple Foundation Models is not wired in.</dd>
        <dt>Limits</dt><dd>National India series, not Makarba measurements. Statistical extrapolation cannot foresee policy changes, shocks or elections. Kaggle data is not included (needs the owner's API key and licence review).</dd>
      </dl>
      <p>Regenerate: <code>python ml/forecast.py</code> (see <code>ml/README.md</code>).</p>
    </section>
  );
}

type Tab = "signals" | "briefing" | "model";

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
  const tabs: [Tab, string][] = [["signals", "Signals"], ["briefing", "AI briefing"], ["model", "Model & data"]];
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
            <div className="cards">{shown.map((x) => <SignalCard key={x.s.id} x={x} endYear={year} />)}</div>
          </>
        )}
        {tab === "briefing" && <AiBriefing sig={sig} endYear={year} region={doc.region} />}
        {tab === "model" && <TechDetails doc={doc} />}
      </div>
    </section>
  );
}
