import type { ReactNode } from "react";
/** AI text is shortened for scanning, but the sanitized complete response remains available on request. */
export function HighlightText({ body, fullBody }: { body: string; fullBody?: string }) {
  if (!fullBody || fullBody === body) return <p>{body}</p>;
  return <><p>{body}</p><details className="highlight-text"><summary>Read full highlight</summary><p>{fullBody}</p></details></>;
}

/** Very small, safe markdown subset for the model's text: **bold** and "- " bullets. Text nodes only, never HTML. */
export function Briefing({ text }: { text: string }) {
  const bold = (l: string) => l.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part.replace(/\*/g, "")));
  const blocks: ReactNode[] = [];
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
