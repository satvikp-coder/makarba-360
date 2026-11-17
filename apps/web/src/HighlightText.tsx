/** AI text is shortened for scanning, but the sanitized complete response remains available on request. */
export function HighlightText({ body, fullBody }: { body: string; fullBody?: string }) {
  if (!fullBody || fullBody === body) return <p>{body}</p>;
  return <><p>{body}</p><details className="highlight-text"><summary>Read full highlight</summary><p>{fullBody}</p></details></>;
}
