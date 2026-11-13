/**
 * SOURCED landmark notes for the area around Makarba (content: data/content/landmarks.json). Each fact is a paraphrase of the cited page, with
 * the date it was read; anything that could not be checked was left out. Photographs are openly licensed Wikimedia Commons files,
 * bundled locally (no network at runtime) and credited next to the image and in docs/project/media-credits.md; cards without a
 * suitable licensed photo show an original drawing instead.
 */
export interface Source { title: string; url: string; retrieved: string }
/** An openly licensed Wikimedia Commons file, resized and recompressed for this site (see media-credits.md). */
export interface Photo { src: string; width: number; height: number; alt: string; caption: string; author: string; licence: string; licenceUrl?: string; commonsUrl: string }
export interface Landmark { id: string; title: string; facts: { text: string; source: number }[]; why: string; sources: Source[]; art: keyof typeof ART; photos?: Photo[]; relatedSlugs: string[] }

// Content lives in data/content/landmarks.json (facts, sources, photo credits); images in data/images/landmarks/.
import landmarksJson from "../../../data/content/landmarks.json";
import { asset } from "./content.js";

export const LANDMARKS: Landmark[] = (landmarksJson as unknown as Landmark[]).map((l) => ({ ...l, photos: l.photos?.map((ph) => ({ ...ph, src: asset(ph.src) })) }));

export const landmarksFor = (slug: string) => LANDMARKS.filter((l) => l.relatedSlugs.includes(slug));

/** Original line drawings (not photographs). Decorative: each card's text carries the information. */
const ART = {
  roza: (
    <>
      <rect x="0" y="70" width="160" height="30" fill="#e2d3ae" />
      <rect x="30" y="50" width="100" height="22" fill="#d9a066" /><rect x="58" y="34" width="44" height="18" fill="#c98a4a" />
      <path d="M58 34 Q80 6 102 34Z" fill="#c98a4a" /><rect x="78" y="2" width="4" height="10" fill="#9a3b1f" />
      <path d="M30 50 Q40 38 50 50Z M110 50 Q120 38 130 50Z" fill="#c98a4a" />
      {[40, 56, 72, 88, 104, 120].map((x) => <rect key={x} x={x - 4} y="56" width="8" height="12" rx="4" fill="#7a3a1f" />)}
    </>
  ),
  saint: (
    <>
      <rect width="160" height="100" fill="#f2e7cf" />
      <path d="M50 90 V45 Q80 10 110 45 V90Z" fill="#d9a066" /><path d="M64 90 V55 Q80 34 96 55 V90Z" fill="#7a3a1f" />
      <circle cx="80" cy="22" r="4" fill="#9a3b1f" />
    </>
  ),
  lake: (
    <>
      <rect width="160" height="100" fill="#e2d3ae" />
      {[0, 1, 2].map((i) => <rect key={i} x={14 + i * 6} y={16 + i * 6} width={132 - i * 12} height={70 - i * 12} fill="none" stroke="#b39463" strokeWidth="3" />)}
      <rect x="32" y="34" width="96" height="34" fill="#7fbfd4" />
      <path d="M40 46 q8 -5 16 0 t16 0 t16 0 t16 0 M48 58 q8 -5 16 0 t16 0 t16 0" stroke="#f4fbff" strokeWidth="2" fill="none" />
    </>
  ),
  city: (
    <>
      <rect width="160" height="100" fill="#f2e7cf" />
      <rect x="20" y="40" width="120" height="60" fill="#d9a066" /><path d="M20 40 L80 14 L140 40Z" fill="#c98a4a" />
      {[34, 58, 82, 106].map((x) => <rect key={x} x={x} y="56" width="14" height="44" rx="7" fill="#7a3a1f" />)}
    </>
  ),
  road: (
    <>
      <rect width="160" height="100" fill="#efe8da" />
      <path d="M60 100 L76 0 H84 L100 100Z" fill="#9aa4ab" /><path d="M80 96 V84 M80 72 V60 M80 48 V36 M80 24 V12" stroke="#f3cf86" strokeWidth="3" />
      <rect x="112" y="40" width="22" height="60" fill="#9fb7b4" /><rect x="136" y="56" width="18" height="44" fill="#b9cfcb" /><rect x="14" y="62" width="30" height="38" fill="#e2d3ae" />
    </>
  ),
  village: (
    <>
      <rect width="160" height="100" fill="#efe8da" />
      {[[10, 60, 30, 40], [44, 66, 26, 34], [74, 56, 30, 44], [108, 64, 22, 36]].map(([x, y, w, h]) => <rect key={x} x={x} y={y} width={w} height={h} fill="#e8c98e" stroke="#b39463" />)}
      <rect x="128" y="18" width="26" height="82" fill="#9fb7b4" /><rect x="134" y="26" width="4" height="4" fill="#efe8da" /><rect x="144" y="40" width="4" height="4" fill="#efe8da" />
    </>
  ),
  mill: (
    <>
      <rect width="160" height="100" fill="#efe8da" />
      <path d="M10 100 V60 L30 46 V60 L50 46 V60 L70 46 V60 L90 46 V100Z" fill="#c9a27e" />
      <rect x="112" y="14" width="12" height="86" fill="#8a6d55" /><circle cx="122" cy="10" r="6" fill="#d8d0c4" /><circle cx="132" cy="6" r="5" fill="#e6e0d6" />
    </>
  ),
} as const;

export function LandmarkCard({ l, headingLevel = 3 }: { l: Landmark; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="landmark" aria-labelledby={`lm-${l.id}`}>
      {l.photos?.length
        ? l.photos.map((p) => <LandmarkPhoto key={p.src} p={p} />)
        : <svg className="landmark-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">{ART[l.art]}</svg>}
      <div>
        <H id={`lm-${l.id}`}>{l.title}</H>
        <ul>{l.facts.map((f, i) => <li key={i}>{f.text}</li>)}</ul>
        <p><strong>Why it matters:</strong> {l.why}</p>
        <p className="sources"><small>Sources: {l.sources.map((s, i) => <span key={s.url}>{i > 0 && "; "}<a href={s.url} rel="noopener noreferrer">{s.title}</a> (retrieved {s.retrieved})</span>)}.{!l.photos?.length && " Illustration: original drawing, not a photograph."}</small></p>
      </div>
    </article>
  );
}

/** A bundled, openly licensed photo with its credit always visible (author, licence, Commons page; resized and recompressed). */
export function LandmarkPhoto({ p }: { p: Photo }) {
  return (
    <figure className="landmark-photo">
      <img src={p.src} width={p.width} height={p.height} alt={p.alt} loading="lazy" decoding="async" />
      <figcaption>
        <small>
          {p.caption} Photo: {p.author},{" "}
          {p.licenceUrl ? <a href={p.licenceUrl} rel="noopener noreferrer">{p.licence}</a> : p.licence}, via{" "}
          <a href={p.commonsUrl} rel="noopener noreferrer">Wikimedia Commons</a>; resized and recompressed.
        </small>
      </figcaption>
    </figure>
  );
}

export function Landmarks({ only }: { only?: Landmark[] }) {
  const list = only ?? LANDMARKS;
  return <div className="landmarks">{list.map((l) => <LandmarkCard key={l.id} l={l} />)}</div>;
}
