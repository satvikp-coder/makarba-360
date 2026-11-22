import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon.js";
import { EraNav } from "./EraNav.js";
import { PastExplorer, useRegistry } from "./PastExplorer.js";
import { seriesToComparison } from "./pastGeo.js";
import {
  STATUS_LABEL, THEME_LABEL, chartCheck, eventsThrough, fetchPast, periodOf, schemeNeedsGeometry, usableEvents, validVisual, yearLabel,
  type Comparison, type PastDoc, type PastEvent, type Theme,
} from "./pastModel.js";
import "./past.css";

const NOW = 2026;
const asset = (p: string) => (/^(https?:)?\//.test(p) ? p : `/${p}`);

function Source({ e }: { e: Pick<PastEvent, "source" | "confidence" | "uncertainty"> }) {
  return (
    <p className="past-src">
      <a href={e.source.url} target="_blank" rel="noopener noreferrer">{e.source.title}</a> · {e.source.tier} source · accessed {e.source.accessed} · <span className={`conf conf-${e.confidence}`}>{e.confidence} confidence</span>
      <span className="past-unc"> Uncertainty: {e.uncertainty}</span>
    </p>
  );
}

function EventCard({ e }: { e: PastEvent }) {
  return (
    <li className={`past-event st-${e.status}`}>
      <div className="past-event-head">
        <time className="past-year">{yearLabel(e)}</time>
        <span className="pill">{THEME_LABEL[e.theme]}</span>
        <span className={`status status-${e.status}`}>{STATUS_LABEL[e.status]}</span>
      </div>
      <h4>{e.title}</h4>
      <p>{e.text}</p>
      <Source e={e} />
    </li>
  );
}

/** Bars for a comparison that passed chartCheck. Approximate values are hatched and named; a table is always available. */
function Bars({ c, pts }: { c: Comparison; pts: { label: string; year: number; value: number; approx: boolean }[] }) {
  const max = Math.max(...pts.map((p) => p.value), 1);
  return (
    <div className="past-bars">
      <svg viewBox={`0 0 ${pts.length * 120} 150`} role="img" aria-label={`${c.title}: ${pts.map((p) => `${p.label} ${p.value} ${c.unit}${p.approx ? " (approximate)" : ""}`).join("; ")}`}>
        <defs><pattern id={`h-${c.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="currentColor" opacity=".35" /></pattern></defs>
        {pts.map((p, i) => {
          const h = (p.value / max) * 100;
          return (
            <g key={p.label} transform={`translate(${i * 120 + 24} 0)`}>
              <rect x="0" y={110 - h} width="72" height={h} rx="6" className="bar" />
              {p.approx && <rect x="0" y={110 - h} width="72" height={h} rx="6" fill={`url(#h-${c.id})`} />}
              <text x="36" y={104 - h} textAnchor="middle" className="bar-v">{p.approx ? "≈" : ""}{p.value}</text>
              <text x="36" y="130" textAnchor="middle" className="bar-l">{p.label}</text>
              <text x="36" y="144" textAnchor="middle" className="bar-y">{p.year}</text>
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <caption>{c.title} ({c.unit})</caption>
        <thead><tr><th>Measurement</th><th>Year</th><th>Value</th><th>Approximate</th></tr></thead>
        <tbody>{pts.map((p) => <tr key={p.label}><td>{p.label}</td><td>{p.year}</td><td>{p.value}</td><td>{p.approx ? "yes" : "no"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ComparisonCard({ c }: { c: Comparison }) {
  const chk = chartCheck(c);
  return (
    <article className="card past-card">
      <h4>{c.title}</h4>
      {chk.ok ? <Bars c={c} pts={chk.points} /> : <p className="past-empty" role="note"><Icon name="info" size={16} /> {chk.reason}</p>}
      <p className="past-meta"><b>Unit:</b> {c.unit} · <b>Method:</b> {c.method}</p>
      <p className="past-meta"><b>Limits:</b> {c.limits}</p>
      <p className="past-src"><a href={c.source.url} target="_blank" rel="noopener noreferrer">{c.source.title}</a> · {c.source.tier} source · accessed {c.source.accessed}</p>
    </article>
  );
}

const ALL = "all" as const;

export function PastPage({ fetcher }: { fetcher?: typeof fetch }) {
  const [state, setState] = useState<{ s: "loading" } | { s: "missing" } | { s: "error" } | { s: "ok"; doc: PastDoc }>({ s: "loading" });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState({ s: "loading" });
    fetchPast(ac.signal, fetcher).then((r) => { if (!ac.signal.aborted) setState(r.status === "ok" ? { s: "ok", doc: r.doc } : { s: r.status }); });
    return () => ac.abort();
  }, [fetcher, tries]);

  if (state.s === "loading") return <section className="past" aria-busy="true"><p role="status" className="past-state">Loading the historical record…</p></section>;
  if (state.s === "missing") return <section className="past"><h1>Past</h1><p className="past-state" role="status">The historical record has not been published yet. Nothing is shown rather than guessing.</p><EraNav current="past" /></section>;
  if (state.s === "error") return <section className="past"><h1>Past</h1><p role="alert" className="past-state">The historical record could not be loaded. <button type="button" onClick={() => setTries(tries + 1)}>Try again</button></p><EraNav current="past" /></section>;
  return <PastBody doc={state.doc} fetcher={fetcher} />;
}

function PastBody({ doc, fetcher }: { doc: PastDoc; fetcher?: typeof fetch }) {
  const events = useMemo(() => usableEvents(doc), [doc]);
  const minYear = events[0]?.year ?? 1400;
  const [year, setYear] = useState(NOW);
  const [theme, setTheme] = useState<Theme | typeof ALL>(ALL);
  const [scheme, setScheme] = useState(doc.tpSchemes[0]?.id ?? "");
  const sliderId = useId();
  const reg = useRegistry(fetcher);
  const comparisons = useMemo(() => [...doc.comparisons, ...(reg.s === "ok" ? reg.reg.measurements.map(seriesToComparison) : [])], [doc.comparisons, reg]);
  const upTo = eventsThrough(events, year).filter((e) => theme === ALL || e.theme === theme);
  const period = periodOf(doc.periods, year);
  const dropped = doc.events.length - events.length;
  const roza = events.filter((e) => e.theme === "heritage");
  const eco = events.filter((e) => e.theme === "ecology");
  const visuals = doc.visualRecord.filter(validVisual).sort((a, b) => a.year - b.year);
  const sch = doc.tpSchemes.find((s) => s.id === scheme);
  const themes = [...new Set(events.map((e) => e.theme))];

  return (
    <article className="past">
      <header className="past-hero">
        <p className="eyebrow"><Icon name="history" size={14} /> Past · Sarkhej &amp; Makarba</p>
        <h1>How has building and road-making changed the setting of Sarkhej Roza?</h1>
        <p className="past-lede">An evidence-led look at roads, highways, town-planning schemes and changing land use around Sarkhej Roza, and what they mean for heritage, water and the people who live here. Only dated, sourced records are shown; plans are never presented as things that were built.</p>
        <EraNav current="past" />
      </header>

      <section aria-labelledby="past-timeline" className="past-sec">
        <h2 id="past-timeline">Timeline</h2>
        <div className="past-slider">
          <label htmlFor={sliderId}>Show what had happened by <b>{year}</b>{period ? <> · <span className="past-period">{period.label}</span></> : null}</label>
          <input id={sliderId} type="range" min={minYear} max={NOW} step={1} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-valuetext={`${year}`} />
          {period && <p className="past-period-sum">{period.summary}</p>}
        </div>
        <div className="past-themes" role="group" aria-label="Filter by theme">
          <button type="button" aria-pressed={theme === ALL} onClick={() => setTheme(ALL)}>All</button>
          {themes.map((t) => <button type="button" key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{THEME_LABEL[t]}</button>)}
        </div>
        <p className="past-count" role="status" aria-live="polite">{upTo.length} documented {upTo.length === 1 ? "record" : "records"} up to {year}.</p>
        {upTo.length === 0 ? <p className="past-empty">No sourced record in this theme has started by {year}.</p> : <ol className="past-events">{upTo.map((e) => <EventCard key={e.id} e={e} />)}</ol>}
        {dropped > 0 && <p className="past-limit">{dropped} record{dropped === 1 ? " was" : "s were"} hidden because the source, date or uncertainty note was incomplete.</p>}
      </section>

      <section aria-labelledby="past-roza" className="past-sec past-roza">
        <h2 id="past-roza">Sarkhej Roza: past and present</h2>
        <p>The Roza is the historic anchor of Makarba. The map shows how it sits among today's roads and water; the records beside it say what is documented about its past.</p>
        <PastExplorer fetcher={fetcher} registry={reg} />
        {visuals.length > 0 && (
          <div className="past-visuals">
            <h3>Dated visual record</h3>
            <ul>{visuals.map((v) => (
              <li key={v.id}>
                <figure>
                  <img src={asset(v.src)} alt={v.alt} loading="lazy" />
                  <figcaption><b>{v.precision === "circa" ? "c. " : ""}{v.year}</b> · {v.kind}. {v.caption} <small>{v.author} · {v.licence} · <a href={v.commonsUrl} target="_blank" rel="noopener noreferrer">source page</a></small></figcaption>
                </figure>
              </li>
            ))}</ul>
            <p className="past-limit">These images show different subjects and viewpoints, so they are a dated record, not a before/after pair. A swipe comparison is offered only for a pair taken from a documented matching viewpoint; none is available yet.</p>
          </div>
        )}
        {roza.length > 0 && <><h3>What is documented</h3><ol className="past-events">{roza.map((e) => <EventCard key={e.id} e={e} />)}</ol></>}
      </section>

      <section aria-labelledby="past-compare" className="past-sec">
        <h2 id="past-compare">Past and present, where the data allow</h2>
        {comparisons.length === 0 ? <p className="past-empty">No comparable measurements are published yet.</p> : <div className="past-grid">{comparisons.map((c) => <ComparisonCard key={c.id} c={c} />)}</div>}
        <p className="past-limit">Built-up surface is charted from a satellite-derived product (modelled, about 90 m cells). Road length, green cover, tank extent, land use and settlement change are not charted: no consistent, dated measurement for the same area has been imported yet (see the layers waiting for evidence). Anecdotes are never converted into percentages.</p>
      </section>

      <section aria-labelledby="past-tp" className="past-sec">
        <h2 id="past-tp">Town-planning schemes</h2>
        {doc.tpSchemes.length === 0 ? <p className="past-empty">No scheme records are published yet.</p> : (
          <>
            <label htmlFor="tp-select">Scheme</label>{" "}
            <select id="tp-select" value={scheme} onChange={(e) => setScheme(e.target.value)}>{doc.tpSchemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {sch && (
              <div className="card past-card" aria-live="polite">
                <h4>{sch.name}</h4>
                <dl className="past-dl">
                  {sch.areaHa !== undefined && <><dt>Area (as listed)</dt><dd>{sch.areaHa} ha</dd></>}
                  <dt>Status (as listed)</dt><dd>{sch.status}{sch.statusDate ? ` · ${sch.statusDate}` : ""}</dd>
                  <dt>Boundary</dt><dd>{schemeNeedsGeometry(sch) ? "Not drawn: no reviewed scheme map with a recorded coordinate system is held." : "Drawn from a reviewed source map."}</dd>
                </dl>
                <p>{sch.note}</p>
                {sch.alsoListed?.map((a) => (
                  <div key={a.source.url} className="past-also" role="note">
                    <b>Also listed elsewhere:</b> {a.status}{a.areaHa !== undefined ? ` · ${a.areaHa} ha` : ""}
                    {a.areaHa !== undefined && sch.areaHa !== undefined && a.areaHa !== sch.areaHa && <> <strong>(differs from the {sch.areaHa} ha above)</strong></>}
                    {a.note && <> {a.note}</>}
                    <span className="past-src"> <a href={a.source.url} target="_blank" rel="noopener noreferrer">{a.source.title}</a> · {a.source.tier} source · accessed {a.source.accessed}</span>
                  </div>
                ))}
                <p className="past-src"><a href={sch.source.url} target="_blank" rel="noopener noreferrer">{sch.source.title}</a> · {sch.source.tier} source · accessed {sch.source.accessed}</p>
              </div>
            )}
          </>
        )}
        <p className="past-limit">A scheme listing says what was proposed or sanctioned, not what was built. “Earlier land use” and “implemented today” need the scheme's own maps and a dated survey of the ground; they are listed under “What is still missing”.</p>
      </section>

      <section aria-labelledby="past-people" className="past-sec">
        <h2 id="past-people">People and Place: past to present</h2>
        <p className="past-empty" role="note"><Icon name="info" size={16} /> No permission-cleared recollections of change over time have been published yet, so none are shown. Nothing here is invented or paraphrased from people who have not agreed to it.</p>
        <p>What residents say about the place today is published, with consent, on <Link to="/voices">Community Voices</Link> and <Link to="/insights">Urban Insights</Link>; read those as present-day perspectives, not as a record of the past.</p>
      </section>

      <section aria-labelledby="past-eco" className="past-sec">
        <h2 id="past-eco">Heritage and water</h2>
        {eco.length > 0 && <ol className="past-events">{eco.map((e) => <EventCard key={e.id} e={e} />)}</ol>}
        <h3>Questions to test, not findings</h3>
        <ul className="past-hyp">
          <li>Whether surrounding building and traffic have reduced how visible and reachable the Roza is from the highway.</li>
          <li>Whether changes in drainage and land cover have affected the tank and the canal.</li>
          <li>Whether road and flyover works have changed how residents travel to the Roza, and who benefits.</li>
        </ul>
        <p className="past-limit">These are plausible hypotheses. They are not demonstrated by the sources on this page.</p>
      </section>

      <section aria-labelledby="past-gaps" className="past-sec">
        <h2 id="past-gaps">What is still missing</h2>
        {doc.gaps.length === 0 ? <p className="past-empty">No open gaps are recorded.</p> : (
          <ul className="past-gaps">{doc.gaps.map((g) => <li key={g.id}><b>{g.need}</b><span>{g.why}</span><em>Could come from: {g.whoCanProvide}</em></li>)}</ul>
        )}
      </section>

      <footer className="past-foot">
        <p>Last updated {doc.updated}. Statuses: <b>documented</b> a dated record; <b>proposed / sanctioned</b> a plan; <b>implemented</b> confirmed built; <b>observed</b> seen today; <b>reconstruction</b> illustrative only.</p>
        <EraNav current="past" />
      </footer>
    </article>
  );
}
