import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { captionFor, viewCell, viewInsights, type CellView, type CohortView } from "@makarba/insights-view";
import { sanitizeQuery } from "@makarba/public-ia";
import { fetchInsights, type InsightsResult } from "./api.js";
import { strings } from "./i18n.js";
import { useCountUp } from "./motion.js";

function CountUp({ n }: { n: number }) {
  return <>{useCountUp(n)}</>;
}
/** A table cell value. Only a real, ready count is animated; "Suppressed", "Unavailable" and "No data" are shown as text, never as a number. */
function Count({ cell }: { cell: CellView }) {
  return cell.kind === "value" ? <CountUp n={cell.count} /> : <>{cell.text}</>;
}

interface RawCohort { cohortId?: string; respondentCategories?: Count[]; ratings?: Count[]; issues?: Count[] }
interface Count { code?: string; value?: string | number; count: number }

function CountTable({ title, rows, view }: { title: string; rows: Count[]; view: CohortView }) {
  if (rows.length === 0) return <p>No {title.toLowerCase()} figures are shown for this group.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <table>
      <caption>{title}</caption>
      <thead><tr><th scope="col">Answer</th><th scope="col">People</th><th scope="col"><span className="visually-hidden">Bar</span></th></tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const cell = viewCell(view, r.count);
          return (
            <tr key={i}>
              <th scope="row">{String(r.code ?? r.value ?? "")}</th>
              <td><Count cell={cell} /></td>
              <td aria-hidden="true"><span className="bar" style={{ width: `${(r.count / max) * 100}%` }} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** P09 Urban Insights: accessible tables for an approved snapshot. Hidden groups are stated as hidden; no total is ever computed or shown. */
export function Insights({ fetcher }: { fetcher?: typeof fetch }) {
  const [params, setParams] = useSearchParams();
  const [r, setR] = useState<InsightsResult | "loading">("loading");
  const load = useCallback(() => {
    const ac = new AbortController();
    setR("loading");
    fetchInsights(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher]);
  useEffect(() => load(), [load]);

  const t = strings.en;
  if (r === "loading") return <section aria-labelledby="in-h"><h1 id="in-h">Urban Insights</h1><p role="status">{t.loading}</p></section>;
  if (r.status !== "ok") {
    return (
      <section aria-labelledby="in-h"><h1 id="in-h">Urban Insights</h1>
        <p role="status">{r.status === "missing" ? "No insights have been published yet." : "Insights could not be loaded or did not pass validation, so nothing is shown."}</p>
        {r.status === "error" && r.retryable && <button type="button" onClick={load}>{t.retry}</button>}
      </section>
    );
  }
  const view = viewInsights(r.data.raw);
  if (!view.ok) return <section aria-labelledby="in-h"><h1 id="in-h">Urban Insights</h1><p role="status">{view.message}</p></section>;
  const raws = ((r.data.raw as { cohorts: RawCohort[] }).cohorts);
  const ids = raws.map((c, i) => c.cohortId ?? `group-${i}`);
  const wanted = sanitizeQuery("P09", params).get("cohort");
  const active = wanted && ids.includes(wanted) ? wanted : null;       // an unknown id is ignored, never turned into a query
  const hiddenCount = view.cohorts.filter((c) => c.kind === "suppressed").length;

  return (
    <section aria-labelledby="in-h">
      <h1 id="in-h">Urban Insights</h1>
      <p>{view.sampleNote}</p>
      <p>These figures describe the people who were interviewed, not all residents. Groups can overlap, so figures for different groups must not be added together, and no overall total is shown.</p>

      {view.cohorts.length === 0 ? <p>No groups have been approved for display yet.</p> : (
        <>
          <label>Group{" "}
            <select value={active ?? ""} onChange={(e) => { const p = new URLSearchParams(sanitizeQuery("P09", params)); if (e.target.value) p.set("cohort", e.target.value); else p.delete("cohort"); setParams(p); }}>
              <option value="">All approved groups</option>
              {ids.map((id, i) => <option key={id} value={id}>{id}{view.cohorts[i]?.kind === "suppressed" ? " (hidden)" : ""}</option>)}
            </select>
          </label>
          <p role="status" aria-live="polite" className="cohort-meta">
            Showing {active ?? "all approved groups"} · collected {view.period.fromMonth} to {view.period.throughMonth} · questionnaire {r.data.questionVersion} · disclosure policy {r.data.policyVersion}
            {hiddenCount > 0 && ` · ${hiddenCount} ${hiddenCount === 1 ? "group is" : "groups are"} hidden to protect privacy`}
          </p>
          {view.cohorts.map((c, i) => {
            const id = ids[i]!;
            if (active && id !== active) return null;
            const raw = raws[i]!;
            const caption = c.kind === "invalid" ? null : captionFor(c, view.period, view.sampleNote);
            return (
              <section key={id} aria-labelledby={`c-${i}`}>
                <h2 id={`c-${i}`}>{c.kind === "invalid" ? "Result not shown" : id}</h2>
                {c.kind === "suppressed" && <p role="note"><strong>Hidden.</strong> {c.explanation}</p>}
                {c.kind === "invalid" && <p role="note">{c.message}</p>}
                {c.kind === "ready" && (
                  <>
                    <table>
                      <caption>{caption!.text}</caption>
                      <tbody>
                        <tr><th scope="row">People interviewed (n)</th><td><Count cell={viewCell(c, c.n)} /></td></tr>
                        <tr><th scope="row">Valid answers</th><td><Count cell={viewCell(c, c.validN)} /></td></tr>
                        <tr><th scope="row">Unsure</th><td><Count cell={viewCell(c, c.unsureN)} /></td></tr>
                        <tr><th scope="row">Missing or not answered</th><td><Count cell={viewCell(c, c.missingN)} /></td></tr>
                      </tbody>
                    </table>
                    <CountTable title="Respondent groups" rows={raw.respondentCategories ?? []} view={c} />
                    <CountTable title="Ratings" rows={raw.ratings ?? []} view={c} />
                    <CountTable title="Reported issues" rows={raw.issues ?? []} view={c} />
                    {(raw.issues ?? []).length > 0 && <p><small>People could name more than one issue, so issue figures can add up to more than the number of people.</small></p>}
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
