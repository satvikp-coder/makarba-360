import { useCallback, useEffect, useRef, useState } from "react";
import { formatDated, type MediaData } from "./api.js";

/** Only https derivatives are rendered; anything pointing at original storage is refused even if the API sent it. */
export function safeImageUrl(u: string): boolean {
  return /^https:\/\//.test(u) && !/\/original(s)?\//i.test(u);
}

type Item = MediaData | "unavailable";

/**
 * Approved photo gallery (#78): responsive grid and an accessible lightbox built on a native modal dialog
 * (focus is trapped, Escape closes, focus returns to the thumbnail). Each photograph shows date, credit,
 * licence and alt text. A missing, unsafe or failing image becomes a plain "unavailable" note, never a hole.
 */
export function Gallery({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const usable = items.filter((m): m is MediaData => m !== "unavailable" && safeImageUrl(m.url) && !broken.has(m.id));
  const missing = items.length - usable.length;
  const cur = open !== null ? usable[open] : undefined;

  const close = useCallback(() => { setOpen(null); }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (cur && !d.open) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
    if (!cur && d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); opener.current?.focus(); }
  }, [cur]);

  const step = (by: number) => { if (open !== null && usable.length) setOpen((open + by + usable.length) % usable.length); };
  const fail = (id: string) => setBroken((s) => new Set(s).add(id));

  if (items.length === 0) return <p>No approved photographs yet.</p>;
  return (
    <>
      {usable.length > 0 && (
        <ul className="gallery">
          {usable.map((m, i) => (
            <li key={m.id}>
              <button type="button" aria-label={`Open photograph: ${m.alt}`} onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }}>
                <img src={m.url} alt={m.alt} width={m.width} height={m.height} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => fail(m.id)} />
              </button>
              <small>{formatDated(m.capturedDate)} · {m.credit} · {m.licence}</small>
            </li>
          ))}
        </ul>
      )}
      {missing > 0 && <p role="status">{missing === 1 ? "A photograph is unavailable." : `${missing} photographs are unavailable.`}</p>}

      <dialog ref={dialogRef} className="lightbox" aria-labelledby="lb-title" onClose={close} onCancel={close}
        onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); step(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); } }}>
        {cur && (
          <figure>
            <h3 id="lb-title" className="visually-hidden">Photograph {open! + 1} of {usable.length}</h3>
            <img src={cur.url} alt={cur.alt} onError={() => fail(cur.id)} referrerPolicy="no-referrer" draggable={false} />
            <figcaption>
              <strong>{cur.alt}</strong><br />
              {formatDated(cur.capturedDate)} · {cur.credit} · {cur.licence}
            </figcaption>
          </figure>
        )}
        <div className="lb-actions">
          <button type="button" onClick={() => step(-1)} disabled={usable.length < 2}>Previous</button>
          <button type="button" onClick={() => step(1)} disabled={usable.length < 2}>Next</button>
          <button type="button" onClick={close}>Close</button>
        </div>
      </dialog>
    </>
  );
}
