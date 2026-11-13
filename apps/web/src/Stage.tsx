import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { fetchPlaces } from "./api.js";
import { useForecasts } from "./forecastData.js";
import { scenarioFor, ANCHORS } from "./scenario.js";
import { fmt, signal, type ForecastDoc, type Series } from "./outlook.js";
import { cancelAi, ensureAi, useAi, PROVIDERS } from "./aiStore.js";
import { useMapState, type Lens } from "./mapCtx.js";
import { MapView } from "./map/MapView.js";
import { MatrixOrb } from "./MatrixOrb.js";
import { Icon, type IconName } from "./Icon.js";
import { plainKey } from "./Shell.js";
import { prefersReducedMotion } from "./motion.js";

/**
 * The stage: the always-mounted 3D map behind every page, with the time dock (a Cesium-style clock and timeline), data lenses,
 * a lens legend that shows the numbers being drawn, and the AI dock. Loaded lazily so the first paint stays light; once mounted it
 * stays, so moving between pages never rebuilds the WebGL scene.
 */
const THIS_YEAR = new Date().getFullYear();
const YEAR_STEP_MS = 110;   // per year while animating to a chosen year
const MAX_YEAR = 2050;

export const LENSES: { id: Lens; label: string; icon: IconName; series?: string; scale?: number; tip: string }[] = [
  { id: "places", label: "Places", icon: "map", tip: "Landmarks and places" },
  { id: "heat", label: "Heat", icon: "thermo", series: "WEATHER_AHD_HOTDAYS", scale: 120, tip: "Days at or above 40 °C in Ahmedabad" },
  { id: "air", label: "Air", icon: "haze", series: "KAGGLE_AHD_PM2.5", scale: 120, tip: "Fine particulate pollution (PM2.5) in Ahmedabad" },
  { id: "growth", label: "Growth", icon: "building", series: "SP.URB.TOTL.IN.ZS", tip: "Buildings coloured by height; urbanisation forecast" },
  { id: "mobility", label: "Mobility", icon: "car", series: "KAGGLE_AHD_NO2", scale: 80, tip: "Traffic exhaust (NO₂) and congestion on main roads" },
];

/** Value of a series in a year: the last observation for "today", the forecast otherwise. */
export function valueAt(s: Series, year: number | null): number {
  if (year === null) return s.history[s.history.length - 1]!.value;
  const sig = signal(s, year);
  return sig ? sig.to.value : s.history[s.history.length - 1]!.value;
}

function Spark({ s, year }: { s: Series; year: number }) {
  const pts = [...s.history.slice(-30), ...s.forecast.filter((p) => p.year <= year)];
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.year), ys = pts.map((p) => p.value);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const X = (v: number) => ((v - x0) / (x1 - x0 || 1)) * 200, Y = (v: number) => 44 - ((v - y0) / (y1 - y0 || 1)) * 40;
  const last = s.history[s.history.length - 1]!;
  const path = (a: { year: number; value: number }[]) => a.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 200 48" className="spark" aria-hidden="true">
      <path d={path(s.history.slice(-30))} className="spark-hist" />
      <path d={path([last, ...s.forecast.filter((p) => p.year <= year)])} className="spark-fcst" pathLength={1} key={year} />
      <line x1={X(last.year)} x2={X(last.year)} y1="2" y2="46" className="spark-now" />
    </svg>
  );
}

/** Time dock: Today/Future, play, a year scrubber with ticks, and the data lenses. */
function TimeDock({ doc }: { doc: ForecastDoc | null }) {
  const m = useMapState();
  const max = doc?.maxYear ?? MAX_YEAR;
  useEffect(() => {
    if (!m.playing) return;
    const id = window.setInterval(() => {
      m.setFuture(true);
      m.setYear(m.year >= max ? THIS_YEAR + 1 : m.year + 1);
      if (m.year + 1 >= max) m.setPlaying(false);
    }, 450);
    return () => clearInterval(id);
  }, [m.playing, m.year, max]);
  // Choosing a year animates to it one year at a time (from today, or from the year shown), forwards or back.
  const [goal, setGoal] = useState<number | null>(null);
  useEffect(() => {
    if (goal === null) return;
    if (goal === m.year) { setGoal(null); return; }
    const id = window.setTimeout(() => m.setYear(m.year + Math.sign(goal - m.year)), prefersReducedMotion() ? 0 : YEAR_STEP_MS);
    return () => clearTimeout(id);
  }, [goal, m.year]);
  const goTo = (y: number) => {
    m.setPlaying(false);
    if (!m.future) { m.setFuture(true); m.setYear(THIS_YEAR); }
    if (prefersReducedMotion()) { m.setYear(y); return; }
    setGoal(y);
  };
  const ticks = [THIS_YEAR + 1, 2030, 2035, 2040, 2045, max].filter((y, i, a) => y <= max && a.indexOf(y) === i);
  const pct = ((m.year - (THIS_YEAR + 1)) / (max - THIS_YEAR - 1)) * 100;
  return (
    <section className="time-dock glass" aria-label="Time and data lens">
      <div className="td-row">
        <div className="seg-tabs" role="group" aria-label="Time">
          <button type="button" aria-pressed={!m.future} onClick={() => { m.setPlaying(false); m.setFuture(false); }} data-tip="The city as it is (F)"><Icon name="map" size={15} />Today</button>
          <button type="button" aria-pressed={m.future} onClick={() => m.setFuture(true)} data-tip="An illustrative future from the forecasts (F)"><Icon name="trend" size={15} />Future</button>
        </div>
        <button type="button" className="td-play" aria-pressed={m.playing} aria-label={m.playing ? "Pause the timeline" : "Play the timeline"} data-tip={m.playing ? "Pause (P)" : "Play the years (P)"} onClick={() => { m.setFuture(true); if (!m.playing && m.year >= max) m.setYear(THIS_YEAR + 1); m.setPlaying(!m.playing); }}>
          <Icon name={m.playing ? "pause" : "play"} size={16} />
        </button>
        <div className="td-scrub" style={{ "--pct": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}>
          <label htmlFor="td-year" className="visually-hidden">Year on the map</label>
          <input id="td-year" type="range" min={THIS_YEAR + 1} max={max} step={1} value={goal ?? m.year} onChange={(e) => goTo(Number(e.target.value))} />
          <ol className="td-ticks" aria-hidden="true">{ticks.map((t) => <li key={t} style={{ left: `${((t - THIS_YEAR - 1) / (max - THIS_YEAR - 1)) * 100}%` }}>{t}</li>)}</ol>
        </div>
        <output className={`td-year ${m.future ? "on" : ""}`} htmlFor="td-year" aria-live="polite">{m.future ? m.year : "Today"}</output>
      </div>
      <div className="td-lenses" role="radiogroup" aria-label="Data lens">
        {LENSES.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={m.lens === l.id} aria-label={l.label} onClick={() => m.setLens(l.id)} data-tip={l.tip}>
            <Icon name={l.icon} size={15} /><span>{l.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The numbers behind the lens, for the chosen year, with who it affects. */
function LensLegend({ doc }: { doc: ForecastDoc | null }) {
  const m = useMapState();
  const l = LENSES.find((x) => x.id === m.lens);
  const s = l?.series ? doc?.series.find((x) => x.id === l.series) : undefined;
  if (!l || !s) return null;
  const now = valueAt(s, null), then = valueAt(s, m.future ? m.year : null);
  const sig = m.future ? signal(s, m.year) : null;
  const who = sig?.impact.who ?? [];
  return (
    <aside className="lens-legend glass hairline" aria-label={`${l.label} lens`} key={l.id}>
      <p className="ll-kicker"><Icon name={l.icon} size={14} /> {l.label} lens</p>
      <h2>{s.label}</h2>
      <p className="ll-nums"><span>{fmt(now)}</span>{m.future && <><Icon name="chevR" size={14} /><b>{fmt(then)}</b></>}<small>{s.unit}{m.future ? ` · ${m.year}` : " · latest"}</small></p>
      <Spark s={s} year={m.future ? m.year : Math.floor(s.history[s.history.length - 1]!.year)} />
      {sig && <p className="ll-impact">{sig.impact.text}</p>}
      {who.length > 0 && <ul className="who-chips" aria-label="Most affected">{who.slice(0, 4).map((w) => <li key={w}>{w}</li>)}</ul>}
    </aside>
  );
}

const TONE_ICON = { positive: "trend", negative: "haze", mixed: "spark" } as const;

/** AI insights dock: matrix orb, live progress, cancel, and the people-centred highlights for the chosen year. */
function AiDock({ doc }: { doc: ForecastDoc | null }) {
  const m = useMapState();
  const nav = useNavigate();
  const year = m.future ? m.year : 2034;
  const ai = useAi(doc, year);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const running = ai.status === "running";
  useEffect(() => { if (!running) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, [running]);
  const secs = ai.progress ? Math.max(0, Math.round((now - ai.progress.startedAt) / 1000)) : 0;
  const state = running ? "thinking" : ai.status === "error" ? "error" : ai.status === "done" ? "done" : "idle";
  const status = running ? `Thinking · ${secs}s${ai.progress?.chars ? ` · ${ai.progress.chars} chars` : ""}` : ai.status === "done" ? `${ai.highlights?.length ?? 0} highlights · ${year}` : ai.status === "error" ? "Couldn't finish" : ai.status === "offline" ? "No AI model available" : "Ready when you are";
  return (
    <section className={`ai-dock glass ${open ? "open" : ""}`} aria-label="AI insights">
      <button type="button" className="ai-dock-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MatrixOrb state={state} size={34} />
        <span><b>AI insights</b> <small>{status}</small></span>
        <Icon name={open ? "chevD" : "chevR"} size={16} />
      </button>
      <p className="visually-hidden" role="status">{ai.status === "done" || ai.status === "error" ? `AI insights: ${status}` : ""}</p>
      {open && (
        <div className="ai-dock-body">
          {running && <p className="ai-progress"><span className="ai-bar" style={{ width: `${Math.min(95, (secs / 60) * 100)}%` }} />{ai.provider ? `${PROVIDERS[ai.provider].label} is reading ${year} forecasts…` : "Starting…"} <button type="button" className="link-btn" onClick={() => doc && cancelAi(doc, year)}>Cancel</button></p>}
          {ai.status === "error" && <p role="alert" className="ai-error">{ai.error} <button type="button" className="link-btn" onClick={() => doc && void ensureAi(doc, year, { force: true })}>Try again</button></p>}
          {ai.status === "offline" && <p>Start Apple Intelligence (macOS) or Ollama with <code>./run.sh</code>, then try again.</p>}
          {(ai.status === "idle" || ai.status === "offline") && doc && <button type="button" className="btn" onClick={() => void ensureAi(doc, year)}><Icon name="spark" size={15} /> Generate for {year}</button>}
          {ai.highlights && ai.highlights.length > 0 && (
            <>
              <p className="ai-badge"><Icon name="spark" size={13} /> AI-generated · {ai.model}</p>
              {ai.headline && <p className="ai-headline">{ai.headline}</p>}
              <ol className="ai-hl">
                {ai.highlights.map((h) => (
                  <li key={h.id} className={`tone-${h.tone}`}>
                    <button type="button" className="ai-hl-btn" onClick={() => { m.setFuture(true); m.setFlyTo(ANCHORS[h.anchor]?.at ?? null); }} data-tip="Show on the map">
                      <span className="ai-ico"><Icon name={h.icon ?? TONE_ICON[h.tone]} size={16} /></span>
                      <span><b>{h.title}</b><small>{h.body}</small></span>
                    </button>
                    {h.who.length > 0 && <ul className="who-chips" aria-label="Most affected">{h.who.map((w) => <li key={w}>{w}</li>)}</ul>}
                    {h.right && <p className="ai-right"><Icon name="users" size={13} /> {h.right}</p>}
                  </li>
                ))}
              </ol>
              <p className="ai-foot"><button type="button" className="link-btn" onClick={() => nav(`/forecasts${year === 2034 ? "" : `?year=${year}`}#ai`)}>Read the full briefing</button> · AI-generated; check the numbers in Outlook.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Pages that read best without the stage's docks over them. */
const READER = /^\/(voices|insights|research|accessibility|places\/|stories)/;

export default function Stage() {
  const m = useMapState();
  const loc = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { doc } = useForecasts();
  const reader = READER.test(loc.pathname);
  const outlook = loc.pathname === "/forecasts";   // the Outlook panel has its own year slider and AI briefing
  // picking a place on the map opens it in Explore, keeping any search or filters already there
  const select = (id: string) => {
    if (loc.pathname !== "/explore") { nav(`/explore?place=${encodeURIComponent(id)}`); return; }
    const p = new URLSearchParams(params); p.set("place", id); setParams(p);
  };
  // all published places, once, and only when the map is in view (reading pages make no extra requests); Explore can narrow them
  const needPlaces = !reader && !m.features;
  useEffect(() => {
    if (!needPlaces) return;
    const ac = new AbortController();
    fetchPlaces(ac.signal).then((r) => { if (!ac.signal.aborted && r.status === "ok") m.setFeatures(r.features); });
    return () => ac.abort();
  }, [needPlaces]);
  // the forecast scene for the chosen year
  const scenario = useMemo(() => (doc && m.future ? scenarioFor(doc, m.year) : null), [doc, m.future, m.year]);
  useEffect(() => { m.setScenario(scenario); }, [scenario]);
  // heavy follow-ups (AI highlights, map pins) wait until the year has settled, so stepping through years stays smooth
  const [settled, setSettled] = useState(m.year);
  useEffect(() => { const id = window.setTimeout(() => setSettled(m.year), m.playing ? 900 : 350); return () => clearTimeout(id); }, [m.year, m.playing]);
  const settledScenario = useMemo(() => (doc && m.future ? scenarioFor(doc, settled) : null), [doc, m.future, settled]);
  // highlights to pin on the map: AI ones when ready, otherwise the rule-based changes
  const ai = useAi(doc, m.future ? settled : 2034);
  useEffect(() => {
    const sc = settledScenario;
    if (!sc) { m.setHighlights(null); return; }
    m.setHighlights(ai.highlights?.length ? ai.highlights.map((h) => ({ id: h.id, title: h.title, at: ANCHORS[h.anchor]?.at ?? sc.changes[0]!.at, tone: h.tone })) : sc.changes.map((c) => ({ id: c.id, title: c.title, at: c.at, tone: "mixed" })));
  }, [settledScenario, ai.highlights]);
  // background AI highlights: default year at start, then whenever the year settles (never in automated browsers or on Save-Data)
  useEffect(() => {
    if (!doc || m.playing || navigator.webdriver || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const id = window.setTimeout(() => { void ensureAi(doc, m.future ? settled : 2034, { background: true }); }, m.future ? 1200 : 2500);
    return () => clearTimeout(id);
  }, [doc, m.future, settled, m.playing]);
  // F toggles today/future, P plays, anywhere the stage is visible
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!plainKey(e) || document.querySelector("dialog[open]")) return;
      if (e.key === "f" || e.key === "F") m.setFuture(!m.future);
      else if (e.key === "p" || e.key === "P") { m.setFuture(true); m.setPlaying(!m.playing); }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [m.future, m.playing]);
  const lens = LENSES.find((l) => l.id === m.lens);
  const lensSeries = lens?.series ? doc?.series.find((s) => s.id === lens.series) : undefined;
  const lensLevel = lensSeries && lens?.scale ? Math.max(0, Math.min(1, valueAt(lensSeries, m.future ? m.year : null) / lens.scale)) : 0.5;
  const features = m.view ?? m.features;
  // the left floating panel's width (CSS --lw, which follows the page and the panel toggle) pads the camera
  const [padLeft, setPadLeft] = useState(0);
  useLayoutEffect(() => { const w = parseFloat(getComputedStyle(document.body).getPropertyValue("--lw")) || 0; if (w !== padLeft) setPadLeft(w); });
  return (
    <section className={`stage ${reader ? "stage-dim" : ""}`} aria-label="3D map of Makarba">
      <div className="stage-map">
        {features && (
          <MapView features={features} sourceAttribution="Places: Makarba 360" selectedId={m.selectedId}
            onSelect={select} scenario={scenario} highlights={m.highlights}
            onFocusChange={m.setFocusId} lens={m.lens} lensLevel={lensLevel} flyTo={m.flyTo} padLeft={reader ? 0 : padLeft} />
        )}
      </div>
      {!reader && !outlook && <TimeDock doc={doc} />}
      {!reader && !outlook && <LensLegend doc={doc} />}
      {!reader && !outlook && <AiDock doc={doc} />}
    </section>
  );
}
