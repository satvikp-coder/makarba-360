import { useEffect, useMemo, useState } from "react";
import { Icon } from "../Icon.js";
import {
  COMMUNITY_THEMES, COMMUNITY_THEME_LABEL, METHOD_LABEL, PERSPECTIVE_LABEL, SCOPE_LABEL, fetchCommunity, periodLabel,
  type CommunityDoc, type CommunityTheme, type PublishedEntry,
} from "./communityModel.js";

const ALL = "all" as const;
type State = { s: "loading" } | { s: "error" } | { s: "ok"; doc: CommunityDoc };

/** Consent-aware recollections of change over time. Shows only what communityModel.parsePublished accepts; never invents or paraphrases people. */
export function PeopleAndPlace({ fetcher }: { fetcher?: typeof fetch }) {
  const [state, setState] = useState<State>({ s: "loading" });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState({ s: "loading" });
    fetchCommunity(ac.signal, fetcher).then((r) => {
      if (ac.signal.aborted) return;
      setState(r.status === "ok" ? { s: "ok", doc: r.doc } : r.status === "missing" ? { s: "ok", doc: { version: 1, status: "no-approved-material", updated: null, minCellSize: 5, entries: [] } } : { s: "error" });
    });
    return () => ac.abort();
  }, [fetcher, tries]);

  if (state.s === "loading") return <p role="status" className="past-state">Loading community recollections…</p>;
  if (state.s === "error") return <p role="alert" className="past-state">Community recollections could not be loaded. <button type="button" onClick={() => setTries(tries + 1)}>Try again</button></p>;
  return state.doc.entries.length === 0 ? <Collecting /> : <Published entries={state.doc.entries} min={state.doc.minCellSize} />;
}

function Collecting() {
  return (
    <>
      <p className="past-empty" role="note"><Icon name="info" size={16} /> No permission-cleared recollections of change over time have been published yet, so none are shown. Nothing here is invented or paraphrased from people who have not agreed to it.</p>
      <h3>What is being collected</h3>
      <p className="past-meta">With each participant's separate permission, researchers record short recollections of how the place has changed, in the years the participant states, in these themes. A theme appears here only once enough separate people have agreed, so no one can be picked out.</p>
      <ul className="pp-themes">{COMMUNITY_THEMES.map((t) => <li key={t}>{COMMUNITY_THEME_LABEL[t]}</li>)}</ul>
    </>
  );
}

function Published({ entries, min }: { entries: PublishedEntry[]; min: number }) {
  const [theme, setTheme] = useState<CommunityTheme | typeof ALL>(ALL);
  const counts = useMemo(() => COMMUNITY_THEMES.map((t) => [t, entries.filter((e) => e.theme === t).length] as const), [entries]);
  const shown = entries.filter((e) => theme === ALL || e.theme === theme);
  const stance = (p: string) => shown.filter((e) => (typeof e.perspective === "string" ? e.perspective : "missing") === p).length;
  const ben = entries.filter((e) => e.theme === "development-benefits").length;
  const cost = entries.filter((e) => e.theme === "development-costs").length;
  return (
    <>
      <p className="past-meta">These are individual, permission-cleared recollections. They are not a representative survey and are not counted as percentages. Locality is ward or neighbourhood level only.</p>
      <h3>Themes collected</h3>
      <ul className="pp-counts">{counts.map(([t, n]) => <li key={t}>{COMMUNITY_THEME_LABEL[t]}: {n >= min ? `${n} published` : `not shown (fewer than ${min} separate contributors)`}</li>)}</ul>
      {(ben === 0) !== (cost === 0) && <p className="past-limit" role="note">Only {ben ? "benefits" : "costs"} of development are published so far; the {ben ? "costs" : "benefits"} side is not yet covered, so read this as incomplete.</p>}
      <div className="past-themes" role="group" aria-label="Filter recollections by theme">
        <button type="button" aria-pressed={theme === ALL} onClick={() => setTheme(ALL)}>All</button>
        {counts.filter(([, n]) => n > 0).map(([t]) => <button type="button" key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{COMMUNITY_THEME_LABEL[t]}</button>)}
      </div>
      <p className="past-count" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? "recollection" : "recollections"} shown. Stance: {stance("positive")} positive, {stance("mixed")} mixed, {stance("negative")} negative, {stance("neutral")} neutral, {stance("missing")} not stated.
      </p>
      <ul className="pp-cards">
        {shown.map((e) => (
          <li key={e.id} className="pp-card">
            <div className="past-event-head">
              <span className="pill">{COMMUNITY_THEME_LABEL[e.theme]}</span>
              <span className={`pp-stance pp-${typeof e.perspective === "string" ? e.perspective : "missing"}`}>{typeof e.perspective === "string" ? PERSPECTIVE_LABEL[e.perspective] : "Stance not stated"}</span>
            </div>
            <p className="pp-text">{e.textKind === "excerpt" ? <>“{e.text}”</> : e.text}</p>
            <dl className="past-dl pp-meta">
              <dt>Period</dt><dd>{periodLabel(e.period)}</dd>
              <dt>Kind</dt><dd>{e.textKind === "excerpt" ? "Short excerpt, shared with permission" : "Researcher paraphrase"}</dd>
              <dt>Where</dt><dd>{typeof e.locality === "string" ? e.locality : "Locality not recorded"}</dd>
              <dt>Collected</dt><dd>{METHOD_LABEL[e.method]}, {e.collectedMonth}</dd>
              <dt>Consent</dt><dd>{SCOPE_LABEL[e.scope]}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
