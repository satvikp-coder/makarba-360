import { useEffect, useId, useState } from "react";
import { fetchMedia, type MediaData } from "./api.js";
import { sliderKey, viewPair, type PairInput } from "./thenNow.js";

const SAFE_URL = /^https:\/\//;
type View = "slider" | "side" | "text";
export interface SourceLite { id: string; citation: string }

/**
 * Accessible Then & Now comparison (#68). Shown only for pairs that `viewPair` marks eligible (two known dates,
 * a source, both images). Three equivalent views: keyboard-operable slider, side by side, and text. If an image
 * fails after the pair was accepted, the narrative (dates, sources, quality, viewpoint) stays visible.
 */
export function ThenNow({ pair, before, after, sources }: { pair: PairInput; before: MediaData | null; after: MediaData | null; sources: SourceLite[] }) {
  const v = viewPair(pair, !!before && !!after && SAFE_URL.test(before.url) && SAFE_URL.test(after.url));
  const [view, setView] = useState<View>("slider");
  const [pos, setPos] = useState(50);
  const [failed, setFailed] = useState(false);
  const name = useId();
  if (!v.eligible || !before || !after) return null;

  const cited = pair.sourceIds.map((id) => sources.find((s) => s.id === id)?.citation ?? "source not listed");
  const move = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) setPos(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
  };
  const showImages = !failed && view !== "text";
  const img = (m: MediaData) => (
    <img src={m.url} alt={m.alt} width={m.width} height={m.height} draggable={false} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );

  return (
    <div className="then-now" data-view={failed ? "text" : view}>
      <fieldset className="tn-views">
        <legend>Comparison view</legend>
        {([["slider", "Slider"], ["side", "Side by side"], ["text", "Text description"]] as const).map(([k, label]) => (
          <label key={k}><input type="radio" name={name} checked={view === k} onChange={() => setView(k)} /> {label}</label>
        ))}
      </fieldset>

      {failed && <p role="status">An image is unavailable. The description below still applies.</p>}

      {showImages && view === "slider" && (
        <div className="tn-slider" style={{ aspectRatio: `${before.width} / ${before.height}` }} onPointerDown={(e) => { if (e.pointerType !== "mouse" || e.button === 0) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported in all environments */ } move(e.clientX, e.currentTarget); } }}
          onPointerMove={(e) => { if (e.buttons && e.currentTarget.hasPointerCapture?.(e.pointerId) !== false) move(e.clientX, e.currentTarget); }}>
          <div className="tn-base">{img(before)}</div>
          <div className="tn-top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>{img(after)}</div>
          <div className="tn-handle" style={{ left: `${pos}%` }} role="slider" tabIndex={0} aria-label="Compare before and after"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pos}
            aria-valuetext={`${pos}% of the earlier photograph shown, ${100 - pos}% of the later photograph`}
            onKeyDown={(e) => { const n = sliderKey(pos, e.key); if (n !== null) { e.preventDefault(); setPos(n); } }} />
        </div>
      )}

      {showImages && view === "side" && (
        <div className="tn-side">
          <figure><figcaption>Before: {v.beforeLabel}</figcaption>{img(before)}<small>{before.credit} · {before.licence}</small></figure>
          <figure><figcaption>After: {v.afterLabel}</figcaption>{img(after)}<small>{after.credit} · {after.licence}</small></figure>
        </div>
      )}

      <div className="tn-facts">
        <p>{v.textAlternative}</p>
        {v.viewpoint === "not-matched" && <p><strong>Not a like-for-like view.</strong></p>}
        <p>Before photo: {before.alt}. After photo: {after.alt}.</p>
        <p>Sources: {cited.join("; ")}</p>
      </div>
    </div>
  );
}

type Loaded = { key: string; before: MediaData | null; after: MediaData | null };
export function ThenNowSection({ pairs, sources, fetcher }: { pairs: (PairInput & { beforeMediaId: string; afterMediaId: string })[]; sources: SourceLite[]; fetcher?: typeof fetch }) {
  const [loaded, setLoaded] = useState<Loaded[] | null>(null);
  const key = pairs.map((p) => p.id).join("|");
  useEffect(() => {
    const ac = new AbortController();
    const get = async (id: string) => { const r = await fetchMedia(id, ac.signal, fetcher); return r.status === "ok" ? r.data : null; };
    Promise.all(pairs.map(async (p) => ({ key: p.id, before: await get(p.beforeMediaId), after: await get(p.afterMediaId) })))
      .then((l) => { if (!ac.signal.aborted) setLoaded(l); }).catch(() => { if (!ac.signal.aborted) setLoaded([]); });
    return () => ac.abort();
  }, [key, fetcher]);
  if (pairs.length === 0) return null;
  if (!loaded) return <section aria-labelledby="then-h"><h2 id="then-h">Then &amp; Now</h2><p role="status">Loading comparison…</p></section>;
  const shown = pairs.map((p) => ({ p, l: loaded.find((x) => x.key === p.id) })).filter(({ p, l }) => l && viewPair(p, !!l.before && !!l.after).eligible);
  if (shown.length === 0) return null; // unsupported pairs are hidden entirely, never shown as a broken slider
  return (
    <section aria-labelledby="then-h">
      <h2 id="then-h">Then &amp; Now</h2>
      {shown.map(({ p, l }) => <ThenNow key={p.id} pair={p} before={l!.before} after={l!.after} sources={sources} />)}
    </section>
  );
}
