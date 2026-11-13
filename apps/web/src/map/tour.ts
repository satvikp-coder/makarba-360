import type { Pos } from "./basemap.js";

/**
 * Guided story tour of the Makarba prototype map; MapView appends every published place after these stops. `kind`/`source` record
 * provenance: sourced stops show their source in an info tooltip, and the site-wide footer discloses that places and narratives are
 * prototype examples. Stops advance only when the visitor asks, so there is no timed content to pause.
 */
export interface TourStop { id: string; title: string; caption: string; kind: "sourced" | "illustrative"; source?: string; center: Pos; zoom: number; pitch: number; bearing: number }

// Content: data/content/tour.json.
import tourJson from "../../../../data/content/tour.json";
export const TOUR: TourStop[] = tourJson as unknown as TourStop[];
