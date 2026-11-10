import type { Pos } from "./basemap.js";

/**
 * Guided story tour of the Makarba prototype map. Each stop says whether its caption is SOURCED (a paraphrased fact from the landmark notes,
 * apps/web/src/landmarks.tsx, with the source named) or an EXAMPLE narrative (composite, fictional content). Stops advance only when the visitor asks,
 * so there is no timed content to pause.
 */
export interface TourStop { id: string; title: string; caption: string; kind: "sourced" | "illustrative"; source?: string; center: Pos; zoom: number; pitch: number; bearing: number }

export const TOUR: TourStop[] = [
  { id: "overview", title: "Makarba, on Ahmedabad's south-western edge", kind: "sourced", source: "Wikipedia: Makarba",
    caption: "Makarba is recorded as a census town in Ahmedabad district, home to 18,090 people at the 2001 census. Sarkhej Roza stands within it.",
    center: [72.5078, 22.9928], zoom: 15.1, pitch: 55, bearing: -24 },
  { id: "roza", title: "Sarkhej Roza", kind: "sourced", source: "Wikipedia: Sarkhej Roza",
    caption: "A tomb built in honour of the Sufi saint Shaikh Ahmed Khattu Ganj Bakhsh, begun in 1445 and completed in 1451, later greatly expanded by Sultan Mahmud Begada. A Monument of National Importance.",
    center: [72.5045, 22.9923], zoom: 17.3, pitch: 65, bearing: 32 },
  { id: "lake", title: "Sarkhej Lake", kind: "sourced", source: "Wikipedia: Sarkhej Roza",
    caption: "A lake of about 6.9 hectares, dug under Mahmud Begada and surrounded with cut stone steps, with his palace at its south-west corner.",
    center: [72.5035, 22.9897], zoom: 16.9, pitch: 58, bearing: -40 },
  { id: "junction", title: "The junction carts", kind: "illustrative",
    caption: "Example narrative: fruit and sugarcane carts beside the shrine approach, busiest from Thursday to Sunday, balancing trade against traffic.",
    center: [72.5062, 22.9936], zoom: 17.5, pitch: 62, bearing: 70 },
  { id: "highway", title: "Highway, bus stand and autos", kind: "sourced", source: "Wikipedia: Sarkhej–Gandhinagar Highway",
    caption: "The Sarkhej–Gandhinagar Highway runs about 44.5 km north to Gandhinagar. The bus and auto stands shown here are example places.",
    center: [72.5122, 22.992], zoom: 16.4, pitch: 60, bearing: -12 },
  { id: "canal", title: "Canal bank and factory road", kind: "illustrative",
    caption: "Example narrative: an evening walk along the canal bank, and a vending stretch on the factory road that grew over about five years.",
    center: [72.511, 22.9968], zoom: 16.1, pitch: 56, bearing: 118 },
  { id: "mill", title: "Old cotton-mill site", kind: "illustrative",
    caption: "Example narrative: a fictional former mill compound. City-wide context (sourced): Ahmedabad's textile mills earned it the name \"Manchester of India\", and several later closed.",
    center: [72.5168, 22.992], zoom: 16.7, pitch: 62, bearing: -60 },
];
