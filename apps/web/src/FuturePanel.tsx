import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useMapState } from "./mapCtx.js";
import { ParticleLoader } from "./Particles.js";
import { Icon } from "./Icon.js";
import { useForecasts } from "./forecastData.js";
import { useAi } from "./aiStore.js";
import { HighlightText } from "./HighlightText.js";

/**
 * The future scene, read through people: every change drawn on the 3D map with who gains, who bears the cost, and the
 * right-to-the-city question it raises (data/content/scenario.json). The selected AI highlight is shown separately and labelled.
 */
export function FuturePanel() {
  const m = useMapState();
  const s = m.scenario;
  const { doc } = useForecasts();
  const ai = useAi(doc, s?.year ?? m.year);
  const active = ai.highlights?.find((h) => h.id === (m.selectedInsightId ?? m.focusId));
  if (!s) return <ParticleLoader label="Loading the forecast scene…" />;
  return (
    <section className="future-panel" aria-labelledby="future-h">
      <h2 id="future-h">Makarba in {s.year}</h2>
      <p className="lead">How the city could look, and who it would be for, if today's trends continue.</p>
      {active && <section className="future-insight" aria-label="Selected AI highlight" aria-live="polite">
        <p className="ai-badge"><Icon name="spark" size={13} /> AI-generated · {s.year}</p>
        <h3>{active.title}</h3>
        <HighlightText body={active.body} fullBody={active.fullBody} />
        {active.who.length > 0 && <p><b>Who may be affected:</b> {active.who.join(", ")}</p>}
        {active.right && <p><b>Question:</b> {active.right}</p>}
        <p className="hint">Interpretation of national and city forecasts, not a local finding.</p>
      </section>}
      <ol className="changes">
        {s.changes.map((c, i) => (
          <li key={c.id} style={{ "--i": i } as CSSProperties} className={`chg chg-${c.id}${m.focusId === c.id ? " on" : ""}`} aria-current={m.focusId === c.id ? "true" : undefined}>
            <button type="button" className="chg-n icon-btn" aria-label={`Show ${c.title} on the map`} data-tip="Show on the map" onClick={() => m.setFlyTo(c.at)}><Icon name="locate" size={15} /></button>
            <div>
              <h3>{c.title}</h3>
              <p>{c.effect}</p>
              {c.people && (
                <dl className="people-lens">
                  <dt><Icon name="trend" size={13} /> Who gains</dt><dd>{c.people.gains}</dd>
                  <dt><Icon name="haze" size={13} /> Who bears the cost</dt><dd>{c.people.costs}</dd>
                  <dt><Icon name="users" size={13} /> Right to the city</dt><dd>{c.people.question}</dd>
                </dl>
              )}
              <p className="chg-because" data-tip="The forecast this change is based on">{c.because}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="hint"><Icon name="info" size={14} /> Illustrative: each change follows national or Ahmedabad forecasts. Not a plan.</p>
      <p><Link to={`/forecasts${s.year === 2034 ? "" : `?year=${s.year}`}`}>All indicators →</Link></p>
    </section>
  );
}
