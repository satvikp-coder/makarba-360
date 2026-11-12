import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStories, type StoriesResult } from "./stories.js";
import { strings } from "./i18n.js";

const EMPTY = "No community accounts have been approved for publication yet.";

/**
 * P08 Community Voices. Shows approved stories from the (proposed) public stories endpoint. Each block keeps its label (fact, memory,
 * official statement); attribution appears only as the API supplies it; nothing is invented. With no stories, a missing endpoint or an
 * invalid payload it says so plainly. Responses are fetched fresh so a withdrawn account disappears on the next load.
 */
export function Voices({ fetcher }: { fetcher?: typeof fetch }) {
  const [r, setR] = useState<StoriesResult | "loading">("loading");
  const load = useCallback(() => {
    const ac = new AbortController();
    setR("loading");
    fetchStories(ac.signal, fetcher).then((x) => { if (!ac.signal.aborted) setR(x); });
    return () => ac.abort();
  }, [fetcher]);
  useEffect(() => load(), [load]);
  useEffect(() => { document.title = `Community Voices – ${strings.en.siteName}`; }, []);

  const stories = r !== "loading" && r.status === "ok" ? r.data.stories : [];
  return (
    <article aria-labelledby="v-h">
      <h1 id="v-h">Community Voices</h1>
      {r === "loading" && <p role="status">{strings.en.loading}</p>}
      {r !== "loading" && r.status === "error" && (
        <>
          <p role="status">Community accounts could not be loaded or did not pass validation, so none are shown.</p>
          {r.retryable && <button type="button" onClick={load}>{strings.en.retry}</button>}
        </>
      )}
      {r !== "loading" && (r.status === "missing" || (r.status === "ok" && stories.length === 0)) && <p><strong>{EMPTY}</strong></p>}
      {stories.map((s) => (
        <section key={s.id} aria-labelledby={`st-${s.id}`}>
          <h2 id={`st-${s.id}`}>{s.title}</h2>
          <p><Link to={`/places/${s.slug}`}>About this place</Link></p>
          {s.blocks.map((b, i) => (
            <figure key={i} className={`block ${b.label === "Verified fact" ? "fact" : b.label === "Official statement" ? "official" : "memory"}`}>
              <figcaption><strong>{b.label}</strong></figcaption>
              {b.label === "Verified fact" && <p>{b.text}</p>}
              {b.label === "What a person remembers" && (
                <>
                  <blockquote><p>{b.quote}</p></blockquote>
                  <p><small>{b.attribution ? `${b.attribution}. ` : ""}{b.period ? `Remembered time: ${b.period}.` : "Time not stated."} This is one person&apos;s memory, not a verified fact.</small></p>
                </>
              )}
              {b.label === "Official statement" && (
                <>
                  <p>{b.text}</p>
                  <p><small>Statement by {b.body}, dated {b.statementDate}. Scope: {b.scope}.</small></p>
                </>
              )}
            </figure>
          ))}
        </section>
      ))}
      <h2>How accounts appear</h2>
      <ul>
        <li>Only with the participant&apos;s separate permission to publish, and never with names, contact details or exact positions unless they agreed to being named.</li>
        <li>Each account is labelled as what a person said, a checked fact or an official statement. A memory is not shown as proof or as the view of all residents.</li>
        <li>If permission is withdrawn, the account is removed and anything built from it is rebuilt without it.</li>
      </ul>
      <p>See the <Link to="/research/methodology">research methodology</Link> for how interviews are done and counted.</p>
    </article>
  );
}
