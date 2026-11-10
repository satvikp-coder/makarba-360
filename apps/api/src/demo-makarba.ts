/**
 * ILLUSTRATIVE DEMO DATA for the mock public API: fictional composite places, timelines, stories and survey-style figures placed
 * around Makarba, Ahmedabad (roughly 22.975-23.005 N, 72.49-72.52 E) so the public map can be demonstrated in its real setting.
 *
 * - Every place, event, story and count here is INVENTED. Themes (street vending at a busy junction, weekend crowds, a canal bank,
 *   a bus and auto stand, a former mill site) are generic composites; no person, quote, business or interview is reproduced.
 * - Sarkhej Roza is a well-known public monument and appears only as an outline of its area. Its sourced history lives in the web
 *   app's landmark notes (apps/web/src/landmarks.ts), separate from this dataset, and is never mixed into these fictional records.
 * - Geometry is a hand-drawn approximation, NOT surveyed. Points are public place markers, never interview positions.
 * - Every payload carries meta.datasetKind = "synthetic" so the site labels it as demonstration data.
 *
 * The frozen contract fixture (docs/project/contracts/fixture-bundle.json) is unchanged and still drives the contract tests.
 */
type Pos = [number, number];

export const DEMO_NOTICE =
  "ILLUSTRATIVE DEMO DATA: fictional composite places, events and figures drawn approximately around Makarba, Ahmedabad. Not survey results, not historical claims, not surveyed geometry.";

const meta = (snapshotId: string) => ({ contractVersion: "1.0.0", datasetKind: "synthetic", snapshotId, methodologyUrl: "/research" }) as const;

const rect = (w: number, s: number, e: number, n: number): Pos[][][] => [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]];

interface DemoPlace {
  n: number;
  slug: string;
  name: string;
  category: string;
  geometry: { type: "Point"; coordinates: Pos } | { type: "MultiLineString"; coordinates: Pos[][] } | { type: "MultiPolygon"; coordinates: Pos[][][] };
  media?: string[];
  /** Fictional timeline, oldest first. Each text already says it is illustrative. */
  timeline: [string, string][];
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PLACES: DemoPlace[] = [
  {
    n: 1, slug: "junction-fruit-carts", name: "Junction fruit and sugarcane carts", category: "market",
    geometry: { type: "Point", coordinates: [72.5062, 22.9936] }, media: ["synthetic-media-1"],
    timeline: [
      ["2021", "Illustrative: a single fruit cart starts trading at the busy junction beside the shrine approach."],
      ["2022", "Illustrative: a sugarcane-juice cart joins; vendors describe asking the shrine trust before setting up."],
      ["2023", "Illustrative: Thursday-to-Sunday visitor crowds make the corner the busiest trading spot of the week."],
      ["2025", "Illustrative: carts shift a few metres back from the carriageway after traffic complaints."],
    ],
  },
  {
    n: 2, slug: "mosque-lane-tea-corner", name: "Mosque-lane tea corner", category: "community",
    geometry: { type: "Point", coordinates: [72.5088, 22.9944] },
    timeline: [
      ["2022", "Illustrative: a tea stall becomes the regular meeting point after evening prayers."],
      ["2024", "Illustrative: benches are added by neighbours; the lane stays closed to cars on festival evenings."],
    ],
  },
  {
    n: 3, slug: "village-bus-stand", name: "Village bus stand", category: "transport",
    geometry: { type: "Point", coordinates: [72.5117, 22.9937] },
    timeline: [
      ["2021", "Illustrative: city buses stop beside the highway service lane; visitors walk in to the shrine."],
      ["2024", "Illustrative: a shaded waiting area is added; weekend queues are longest on Fridays."],
    ],
  },
  {
    n: 4, slug: "highway-auto-stand", name: "Highway auto-rickshaw stand", category: "transport",
    geometry: { type: "Point", coordinates: [72.5126, 22.9905] },
    timeline: [
      ["2022", "Illustrative: shared autos gather where the arterial road meets the highway."],
      ["2025", "Illustrative: drivers report visitors arriving from across the city and from other cities such as Surat."],
    ],
  },
  {
    n: 5, slug: "canal-bank-walk", name: "Canal bank walk", category: "open_space",
    geometry: { type: "MultiLineString", coordinates: [[[72.4975, 23.0013], [72.5031, 22.9989], [72.5090, 22.9976], [72.5136, 22.9963]]] },
    timeline: [
      ["2021", "Illustrative: an unpaved path along the canal bank is used as a shortcut to the bus stand."],
      ["2023", "Illustrative: evening walkers and snack carts appear along the bank on weekends."],
    ],
  },
  {
    n: 6, slug: "old-cotton-mill-site", name: "Old cotton-mill site", category: "industry",
    geometry: { type: "MultiPolygon", coordinates: rect(72.515, 22.9905, 72.5185, 22.9935) },
    timeline: [
      ["2021", "Illustrative: the long sheds of a former mill compound stand mostly unused."],
      ["2024", "Illustrative: part of the compound is used as a weekend parking overflow."],
    ],
  },
  {
    n: 7, slug: "factory-road-vending-stretch", name: "Factory road vending stretch", category: "market",
    geometry: { type: "MultiLineString", coordinates: [[[72.5137, 22.9966], [72.5168, 22.9981], [72.5198, 22.9996]]] },
    timeline: [
      ["2021", "Illustrative: a handful of carts serve mill-shift workers at lunchtime."],
      ["2023", "Illustrative: vending spreads along the road; space on the footpath becomes contested."],
      ["2025", "Illustrative: a small stall opens with money pooled by friends and neighbours."],
    ],
  },
  {
    n: 8, slug: "weekend-mela-ground", name: "Weekend and mela ground", category: "community",
    geometry: { type: "MultiPolygon", coordinates: rect(72.506, 22.99, 72.5078, 22.9912) },
    timeline: [
      ["2022", "Illustrative: an open plot fills with temporary stalls for the yearly fair (mela)."],
      ["2024", "Illustrative: the same plot hosts weekend food stalls from Thursday to Sunday."],
    ],
  },
  {
    n: 9, slug: "lake-edge-steps", name: "Lake-edge viewing steps", category: "open_space",
    geometry: { type: "Point", coordinates: [72.5036, 22.9908] },
    timeline: [["2023", "Illustrative: visitors stop on the steps at sunset; a photo spot during the fair."]],
  },
  {
    n: 10, slug: "sarkhej-roza-area", name: "Sarkhej Roza (landmark area)", category: "heritage",
    geometry: { type: "MultiPolygon", coordinates: rect(72.5032, 22.9912, 72.5058, 22.9934) },
    timeline: [["2026", "Illustrative placeholder: sourced landmark notes are shown separately on the site; no demo history is claimed here."]],
  },
  {
    n: 11, slug: "crowdfunded-snack-stall", name: "Crowd-funded snack stall", category: "market",
    geometry: { type: "Point", coordinates: [72.51, 22.9922] },
    timeline: [
      ["2024", "Illustrative: a first-time vendor starts with savings pooled by a small circle of friends."],
      ["2025", "Illustrative: the stall moves under a tree after a season of rain."],
    ],
  },
  {
    n: 12, slug: "visitor-drop-off", name: "Visitor drop-off point", category: "transport",
    geometry: { type: "Point", coordinates: [72.5059, 22.9921] },
    timeline: [["2023", "Illustrative: cars and autos drop visitors at the shrine gate, slowing the lane on weekends."]],
  },
];

const SOURCE_ID = "demo-source-composite";

export const demoLocations = {
  type: "FeatureCollection",
  features: PLACES.map((p) => ({
    type: "Feature",
    id: id(p.n),
    geometry: p.geometry,
    properties: {
      locationId: id(p.n), slug: p.slug, name: { en: p.name }, category: p.category, publicationState: "published",
      lastReviewedDate: "2026-11-10", sourceIds: [SOURCE_ID], mediaIds: p.media ?? [],
    },
  })),
  page: { limit: 50, nextCursor: null },
  meta: meta("demo-makarba-locations-1"),
};

const SOURCE = {
  id: SOURCE_ID,
  citation: "Illustrative demo note: fictional composite written for this demonstration, not a historical or survey source",
  url: "https://example.invalid/demo/makarba-composite",
  licence: "synthetic-test-only",
  verificationState: "synthetic",
};

/** History per published slug. Only the first place keeps a (synthetic) comparison pair so the Then & Now path stays demonstrable. */
export function demoHistory(slug: string) {
  const p = PLACES.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    locationId: id(p.n),
    sources: [SOURCE],
    events: p.timeline.map(([year, text], i) => ({ id: `demo-${p.slug}-${i + 1}`, sourceId: SOURCE_ID, date: { value: year, precision: "year" }, evidenceType: "illustrative", text })),
    comparisonPairs: p.n === 1
      ? [{
          id: "demo-pair-1", locationId: id(1), beforeMediaId: "synthetic-before", afterMediaId: "synthetic-after",
          beforeDate: { value: "2021", precision: "year" }, afterDate: { value: "2025", precision: "year" }, sourceIds: [SOURCE_ID],
          matchingViewpointNotes: "Illustrative pair for demonstrating the comparison view only", evidenceQuality: "synthetic",
        }]
      : [],
    meta: meta(`demo-makarba-history-${p.n}`),
  };
}

export const demoSlugs = PLACES.map((p) => p.slug);

export const demoMedia = {
  id: "synthetic-media-1",
  locationId: id(1),
  url: "https://example.invalid/public/synthetic-panorama.webp",
  contentType: "image/webp",
  width: 4096,
  height: 2048,
  format: "equirectangular",
  alt: "Synthetic panorama placeholder; no real photograph supplied",
  credit: "Synthetic test asset descriptor",
  licence: "synthetic-test-only",
  capturedDate: { value: "2026-01-01", precision: "day" },
  publicationState: "published",
  staticFallbackUrl: "https://example.invalid/public/synthetic-static.webp",
  meta: meta("synthetic-media-1"),
};

const ready = (cohortId: string, n: number, missingN: number, unsureN: number, respondentCategories: [string, number][], ratings: [number, number][], issues: [string, number][], denominatorLabel: string) => {
  const validAnswerN = ratings.reduce((s, [, c]) => s + c, 0);
  return {
    cohortId, suppressed: false, n, validAnswerN, missingN, unsureN,
    respondentCategories: respondentCategories.map(([code, count]) => ({ code, count })),
    ratings: ratings.map(([value, count]) => ({ value, count })),
    issues: issues.map(([code, count]) => ({ code, count })),
    denominatorLabel, countingRule: "Illustrative demo counts; a person can appear in more than one group",
  };
};

export const demoCohorts = [
  ready("demo-weekend-visitors", 48, 4, 6,
    [["local-resident", 14], ["city-visitor", 22], ["out-of-town-visitor", 12]],
    [[1, 3], [2, 5], [3, 10], [4, 14], [5, 6]],
    [["traffic-congestion", 26], ["crowding-thu-sun", 21], ["parking", 17], ["waste", 9]],
    "38 valid illustrative answers about the junction area"),
  ready("demo-street-vendors", 16, 1, 2,
    [["cart-vendor", 9], ["stall-vendor", 7]],
    [[1, 2], [2, 3], [3, 4], [4, 3], [5, 1]],
    [["vending-space", 12], ["traffic-conflict", 8], ["permission-uncertainty", 6]],
    "13 valid illustrative answers from fictional vendors"),
  { cohortId: "demo-canal-bank-small", suppressed: true, n: null, validAnswerN: null, missingN: null, unsureN: null, respondentCategories: [], ratings: [], issues: [], reasonCode: "DISCLOSURE_POLICY" },
];

export const demoInsights = {
  cohorts: demoCohorts,
  collectionPeriod: { fromMonth: "2026-01", throughMonth: "2026-03" },
  questionVersion: "demo-survey-v1",
  policyVersion: "demo-disclosure-v1",
  sampleNote: "ILLUSTRATIVE DEMO figures: invented counts for demonstrating the charts, not real Makarba findings or population estimates. Groups overlap and have no common total.",
  meta: meta("demo-makarba-insights-1"),
};

/** Proposed stories contract (issue #80). Fictional composite voices only; the attribution says so on every block. */
export const demoStories = {
  stories: [
    {
      id: "demo-story-1", locationId: id(1), slug: "junction-fruit-carts", title: "Illustrative: a weekend at the junction carts",
      blocks: [
        { label: "What a person remembers", quote: "On Thursdays the crowd starts early and by Sunday evening the whole corner is busy with families from all over the city.", period: "recent years", attribution: "fictional composite voice (illustrative demo)" },
        { label: "What a person remembers", quote: "We set up only after asking at the shrine office, and we pull back when the traffic police come by.", period: null, attribution: "fictional composite voice (illustrative demo)" },
      ],
    },
    {
      id: "demo-story-2", locationId: id(7), slug: "factory-road-vending-stretch", title: "Illustrative: starting small on the factory road",
      blocks: [
        { label: "What a person remembers", quote: "A few friends chipped in so the stall could open; the first months were about finding a spot nobody objected to.", period: "about five years of change", attribution: "fictional composite voice (illustrative demo)" },
      ],
    },
  ],
  meta: meta("demo-makarba-stories-1"),
};
