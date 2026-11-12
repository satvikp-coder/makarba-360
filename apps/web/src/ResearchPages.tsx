import { Link } from "react-router-dom";
import { LANGUAGES } from "./i18n.js";
import { LANDMARKS } from "./landmarks.js";

const STATUS = "Status: this describes the planned research approach. Data collection with real participants has not started and requires ethics and institutional approval first. Nothing on this page is a research result.";

export function Methodology() {
  return (
    <article aria-labelledby="m-h">
      <h1 id="m-h">Research methodology</h1>
      <p><strong>{STATUS}</strong></p>

      <h2>How the research is done</h2>
      <p>The study combines place observation, in-person interviews with people who use or know Makarba, and research into historical sources. Interviews are carried out by trained researchers in person. Members of the public cannot enter answers to the interview questions on this website.</p>

      <h2>Who is asked, and what that means</h2>
      <p>People are recruited across different routes, roles (for example residents, shopkeepers, visitors, workers) and times of day. This is a convenience and purposive sample, not a random one. Results therefore describe the people who were asked. They are <strong>not</strong> estimates for all residents of Makarba, and no confidence intervals or population claims are made.</p>

      <h2>How answers are counted</h2>
      <ul>
        <li>Each chart shows how many people answered, how many skipped or were unsure, and the collection period.</li>
        <li>One interview is counted once in overall totals, even if it mentions several places. For a place, only interviews that are about that place are counted.</li>
        <li>Where a question allows several answers, percentages can add up to more than 100%.</li>
        <li>Where a group is too small to publish safely, it is hidden and marked as hidden. A hidden value is not zero and cannot be worked out from other figures.</li>
        <li>&ldquo;No data&rdquo; (nothing collected), &ldquo;zero&rdquo; (collected, none) and &ldquo;hidden&rdquo; (protected) are always shown differently.</li>
      </ul>

      <h2>Kinds of evidence</h2>
      <p>The site keeps four kinds apart: researcher observations (with date and method), what respondents said (with the question and consent), historical claims (with citation, date and quality) and facts checked by a reviewer. Conflicting accounts are shown with their source rather than settled silently. Remembered change is not proof of cause, and traffic is not measured unless it was actually counted.</p>

      <h2>Privacy</h2>
      <p>Participation is voluntary and based on consent. Exact interview positions, names, raw answers and recordings are never published. The place an interview was held can differ from the place it is about, and only the second is used for place summaries.</p>

      <section aria-labelledby="prototype-data" className="prototype-data">
        <h2 id="prototype-data" tabIndex={-1}>About the data</h2>
        <p>This version of the site runs on a <strong>prototype dataset</strong> so the map, stories and charts can be shown before any real results are approved for publication.</p>
        <table>
          <caption>What each kind of content on this site is</caption>
          <thead><tr><th scope="col">Content</th><th scope="col">What it is</th></tr></thead>
          <tbody>
            <tr><th scope="row">Places, timelines, stories and figures</th><td>Composite, fictional examples. They are written around general themes (street vending at a busy junction, weekend crowds, a bus and auto stand, a canal bank, a former mill site) and contain no real participant, quote, name or interview. They are not survey results.</td></tr>
            <tr><th scope="row">Landmark notes</th><td>Sourced facts about well-known public landmarks, paraphrased with the source and the date it was read. Anything that could not be checked was left out.</td></tr>
            <tr><th scope="row">Map</th><td>An approximate sketch drawn for this prototype (not surveyed). Sarkhej Roza is placed at its published coordinates; roads, the lake, the canal and building heights are approximate or generated.</td></tr>
            <tr><th scope="row">Photographs and illustrations</th><td>Landmark photographs are openly licensed Wikimedia Commons files, credited beside each image. Other illustrations are original drawings, not photographs.</td></tr>
          </tbody>
        </table>
        <p>Real survey results will only replace these examples after ethics approval, consent checks and review. Even then, exact interview locations are never published, small groups stay hidden (never shown as zero), and the public cannot submit answers on this site.</p>
        <p>Limits: the 3D map needs WebGL; without it a flat sketch and the text list are shown. The map works offline: it loads no outside map tiles, fonts or images.</p>
      </section>

      <p>See <Link to="/research/sources">sources and credits</Link> and <Link to="/accessibility">accessibility and language help</Link>.</p>
    </article>
  );
}

export function Sources() {
  return (
    <article aria-labelledby="s-h">
      <h1 id="s-h">Sources and credits</h1>
      <h2>Map data</h2>
      <p>Base map: an approximate sketch of Makarba drawn for this project and bundled with the site (roads, lake, canal, green spaces and generated building blocks). It is not surveyed and uses no outside map tiles or third-party map data. Place data shown on the map comes from this project&apos;s published records.</p>
      <h2>Landmark notes (sourced)</h2>
      <p>Each landmark note is a paraphrase of the page below, read on the date shown.</p>
      <ul>{[...new Map(LANDMARKS.flatMap((l) => l.sources).map((s) => [s.url, s])).values()].map((s) => (
        <li key={s.url}><a href={s.url} rel="noopener noreferrer">{s.title}</a> (retrieved {new Date(s.retrieved + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}; text CC BY-SA 4.0, paraphrased)</li>
      ))}</ul>
      <h2>Photographs</h2>
      <p>Landmark photographs are openly licensed files from Wikimedia Commons, resized and recompressed and stored with the site so it works offline. Share-alike (CC BY-SA) images are shared under the same licence.</p>
      <ul>{LANDMARKS.flatMap((l) => l.photos ?? []).map((p) => (
        <li key={p.src}>{p.caption} {p.author}; {p.licenceUrl ? <a href={p.licenceUrl} rel="noopener noreferrer">{p.licence}</a> : p.licence}; <a href={p.commonsUrl} rel="noopener noreferrer">Commons file page</a>.</li>
      ))}</ul>
      <p>Cards without a suitable licensed photograph show original drawings made for this project.</p>
      <h2>Historical sources for places</h2>
      <p>Each place page lists its own citations, licences and photograph credits. No historical sources about the places have been approved for general listing here yet; none are shown until their rights and dates have been checked.</p>
      <h2>Corrections</h2>
      <p>If a source is found to be wrong or withdrawn, the citation is kept and flagged and the affected content is removed or corrected. A public contact route has not been set up yet.</p>
    </article>
  );
}

export function AccessibilityHelp() {
  const available = LANGUAGES.filter((l) => l.available).map((l) => l.label);
  const pending = LANGUAGES.filter((l) => !l.available).map((l) => l.label);
  return (
    <article aria-labelledby="a-h">
      <h1 id="a-h">Accessibility and language</h1>
      <h2>What is built in</h2>
      <ul>
        <li>A &ldquo;Skip to main content&rdquo; link, labelled navigation, one main heading per page and visible keyboard focus.</li>
        <li>Every map has a text list of the same places, so the map is never the only way to find or select a place. The list works if the map cannot load.</li>
        <li>Controls are sized for touch, and the page reflows down to 320 pixels wide without sideways scrolling.</li>
        <li>Animation is turned off for people who ask their device for reduced motion.</li>
      </ul>
      <h2>What has not been checked yet</h2>
      <p>The site has been tested with automated checks and in a desktop browser. It has <strong>not</strong> yet been reviewed by people using screen readers, switch devices or a range of phones, and we do not claim full conformance with any accessibility standard. Problems found in that review will be recorded here.</p>
      <h2>Language</h2>
      <p>Available now: {available.join(", ")}. {pending.join(" and ")} {pending.length > 1 ? "are" : "is"} not offered yet because translations must be reviewed by a fluent speaker first; screens are never shown in a language that has not been reviewed. Where a translation is missing, English is shown and labelled.</p>
    </article>
  );
}
