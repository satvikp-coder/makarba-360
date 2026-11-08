import { Link } from "react-router-dom";

/**
 * P08 Community Voices. No public contract for approved accounts exists yet (a quote/theme DTO would have to come through the
 * handoff process), so this page does not invent or imply any. It states how accounts will be handled.
 */
export function Voices() {
  return (
    <article aria-labelledby="v-h">
      <h1 id="v-h">Community Voices</h1>
      <p><strong>No community accounts have been approved for publication yet.</strong></p>
      <h2>How accounts will appear</h2>
      <ul>
        <li>Only with the participant&apos;s separate permission to publish, and never with names, contact details or exact positions.</li>
        <li>Each account is labelled as what a person said, with the question, the place it is about, the period and how many people were asked. It is not shown as a verified fact or as the view of all residents.</li>
        <li>If permission is withdrawn, the account is removed and anything built from it is rebuilt without it.</li>
      </ul>
      <p>See the <Link to="/research/methodology">research methodology</Link> for how interviews are done and counted.</p>
    </article>
  );
}
