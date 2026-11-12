/**
 * SOURCED landmark notes for the area around Makarba. These are the only factual statements on the prototype site and are kept apart
 * from the composite, fictional example data (places, timelines, stories, figures). Each fact is a paraphrase of the cited page, with
 * the date it was read; anything that could not be checked was left out. Photographs are openly licensed Wikimedia Commons files,
 * bundled locally (no network at runtime) and credited next to the image and in docs/project/media-credits.md; cards without a
 * suitable licensed photo show an original drawing instead.
 */
export interface Source { title: string; url: string; retrieved: string }
/** An openly licensed Wikimedia Commons file, resized and recompressed for this site (see media-credits.md). */
export interface Photo { src: string; width: number; height: number; alt: string; caption: string; author: string; licence: string; licenceUrl?: string; commonsUrl: string }
export interface Landmark { id: string; title: string; facts: { text: string; source: number }[]; why: string; sources: Source[]; art: keyof typeof ART; photos?: Photo[]; relatedSlugs: string[] }

const RETRIEVED = "2026-11-10";
const MEDIA = "/media/landmarks/";
const PHOTOS = {
  roza: {
    src: MEDIA + "sarkhej-roza.jpg", width: 960, height: 720,
    alt: "The Sarkhej Roza mosque seen across its wide stone-paved courtyard: a long arcaded building with a row of small domes and one large central dome.",
    caption: "Sarkhej Roza, front view across the courtyard (photographed 2011).",
    author: "Museeb fakih", licence: "Public domain", commonsUrl: "https://commons.wikimedia.org/wiki/File:Sarkhej.JPG",
  },
  tank: {
    src: MEDIA + "sarkhej-tank-outlet-1855.jpg", width: 960, height: 802,
    alt: "Sepia albumen print of a carved stone wall with three round openings, the outlet of the Sarkhej tank, with a large tree behind it.",
    caption: "Outlet of the Sarkhej tank, photographed in 1855 by William Johnson.",
    author: "William Johnson (photographer); SMU Central University Libraries", licence: "No known copyright restrictions (public domain)", licenceUrl: "https://www.flickr.com/commons/usage/",
    commonsUrl: "https://commons.wikimedia.org/wiki/File:Outlet_of_Sarkhej_Roza_Tank_Ahmedabad_1855.jpg",
  },
  gallery: {
    src: MEDIA + "sarkhej-queens-gallery-1878.jpg", width: 878, height: 581,
    alt: "Engraving of a two-storey colonnaded gallery with steps down to the water, an elephant at the left and small boats in front.",
    caption: "Engraving of the gallery leading to the queens' tombs at Sarkhej, from Louis Rousselet's book on India (1878).",
    author: "Louis Rousselet", licence: "Public domain", commonsUrl: "https://commons.wikimedia.org/wiki/File:Queen%27s_tomb.jpg",
  },
  sg: {
    src: MEDIA + "sg-highway-2012.jpg", width: 768, height: 576,
    alt: "A wide divided highway with light traffic, street lamps along the median and apartment blocks and power pylons on the left.",
    caption: "Sarkhej–Gandhinagar Highway, Ahmedabad (photographed 2012).",
    author: "Abhishek.ujoshi", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0", commonsUrl: "https://commons.wikimedia.org/wiki/File:SG._Highway.JPG",
  },
  calico: {
    src: MEDIA + "calico-mills-chimney.jpg", width: 960, height: 640,
    alt: "A tall brick mill chimney rising above trees, with the dome of a small stone mosque in the foreground.",
    caption: "The Calico Mills chimney in Ahmedabad, with Baba Lului's Mosque in front (photographed 2021). Not in Makarba.",
    author: "Imfarhad7", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", commonsUrl: "https://commons.wikimedia.org/wiki/File:Calico_Mills_3.jpg",
  },
} satisfies Record<string, Photo>;
const W = {
  roza: { title: "Wikipedia: Sarkhej Roza", url: "https://en.wikipedia.org/wiki/Sarkhej_Roza", retrieved: RETRIEVED },
  makarba: { title: "Wikipedia: Makarba", url: "https://en.wikipedia.org/wiki/Makarba", retrieved: RETRIEVED },
  sg: { title: "Wikipedia: Sarkhej–Gandhinagar Highway", url: "https://en.wikipedia.org/wiki/Sarkhej%E2%80%93Gandhinagar_Highway", retrieved: RETRIEVED },
  amd: { title: "Wikipedia: Ahmedabad", url: "https://en.wikipedia.org/wiki/Ahmedabad", retrieved: RETRIEVED },
};

export const LANDMARKS: Landmark[] = [
  {
    id: "sarkhej-roza", title: "Sarkhej Roza", art: "roza", photos: [PHOTOS.roza], relatedSlugs: ["sarkhej-roza-area"], sources: [W.roza],
    facts: [
      { text: "A complex of tombs and a mosque in Makarba, about 7 km south-west of central Ahmedabad.", source: 0 },
      { text: "The tomb was begun in 1445 under Muhammad Shah II and completed in 1451 under his son Qutbuddin Ahmad Shah II.", source: 0 },
      { text: "Sultan Mahmud Begada later expanded the complex greatly, adding a palace and a mausoleum for himself and his family.", source: 0 },
      { text: "It is a Monument of National Importance on the Archaeological Survey of India's list; encroachment has reduced the complex from about 29 to about 14 hectares.", source: 0 },
      { text: "Le Corbusier compared its design to the Acropolis of Athens, which is why it is sometimes called the \"Acropolis of Ahmedabad\".", source: 0 },
    ],
    why: "It is the historic anchor of the area and a nationally protected monument, so it is the natural reference point for the streets, stalls and transport around it.",
  },
  {
    id: "ahmed-khattu", title: "Shaikh Ahmed Khattu Ganj Bakhsh", art: "saint", relatedSlugs: ["sarkhej-roza-area"], sources: [W.roza],
    facts: [
      { text: "The tomb at the heart of the Roza was built in honour of the Sufi saint Shaikh Ahmed Khattu Ganj Bakhsh, who died at Sarkhej in 1445.", source: 0 },
      { text: "His mausoleum is described as the largest of its kind in Gujarat.", source: 0 },
    ],
    why: "The saint's tomb is the reason the Roza was built, and it remains the heart of the complex that the rest of the area grew around.",
  },
  {
    id: "sarkhej-lake", title: "Sarkhej Lake", art: "lake", photos: [PHOTOS.tank, PHOTOS.gallery], relatedSlugs: ["lake-edge-steps"], sources: [W.roza],
    facts: [
      { text: "A lake of about 6.9 hectares was dug under Mahmud Begada and surrounded with cut stone steps.", source: 0 },
      { text: "Mahmud Begada built a palace, now in ruins, at the lake's south-west corner.", source: 0 },
    ],
    why: "Water and stepped edges make the lake the complex's open public space, and it ties the monuments together.",
  },
  {
    id: "ahmed-shah", title: "Ahmed Shah I and Ahmedabad", art: "city", relatedSlugs: [], sources: [W.amd],
    facts: [{ text: "Ahmed Shah I laid the foundation of Ahmedabad on 26 February 1411 and named the city after himself.", source: 0 }],
    why: "Sarkhej's monuments belong to the same Sultanate period that founded the city, which links this edge of Ahmedabad to its origins.",
  },
  {
    id: "sg-highway", title: "Sarkhej–Gandhinagar Highway", art: "road", photos: [PHOTOS.sg], relatedSlugs: ["highway-auto-stand", "village-bus-stand"], sources: [W.sg],
    facts: [
      { text: "A highway of about 44.5 km running from Sarkhej in the south-west to Gandhinagar in the north.", source: 0 },
      { text: "It forms a major part of National Highway 147; in 2015 its administration passed from the NHAI to the Government of Gujarat.", source: 0 },
    ],
    why: "It is the area's main link to the rest of the city, bringing buses, autos and visitors, and with them traffic pressure at the junctions.",
  },
  {
    id: "makarba", title: "Makarba", art: "village", relatedSlugs: [], sources: [W.makarba],
    facts: [{ text: "Recorded as a census town in Ahmedabad district, with a population of 18,090 at the 2001 census.", source: 0 }],
    why: "It is the setting for everything on this map: the Roza, the lake and the places and stories are all in and around Makarba.",
  },
  {
    id: "textiles", title: "Ahmedabad's textile mills (city-wide context)", art: "mill", photos: [PHOTOS.calico], relatedSlugs: ["old-cotton-mill-site"], sources: [W.amd],
    facts: [
      { text: "Its textile industry earned Ahmedabad the nickname \"Manchester of India\".", source: 0 },
      { text: "From the mid-1970s, facing competition from automation and specialised domestic looms, several mills closed, leaving tens of thousands of workers without income.", source: 0 },
    ],
    why: "City-wide context: mill closures are part of how Ahmedabad's working neighbourhoods changed.",
  },
];

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
