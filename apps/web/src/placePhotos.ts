/**
 * Photographs for place cards and profiles. All are openly licensed Wikimedia Commons files, resized and bundled under
 * public/media (credits in docs/project/media-credits.md). Photos of Sarkhej Roza and its lake show the real place; the others are
 * REPRESENTATIVE Ahmedabad scenes of the same kind of place and are captioned that way.
 */
export interface PlacePhoto { src: string; alt: string; title: string; credit: string; licence: string; source: string; representative: boolean }

// Content: data/content/places.json (photo, credits per place slug); images: data/images/places/.
import placesJson from "../../../data/content/places.json";
import { asset } from "./content.js";

export const PHOTOS: Record<string, PlacePhoto> = Object.fromEntries(
  Object.entries(placesJson as unknown as Record<string, { photo: PlacePhoto }>).map(([k, v]) => [k, { ...v.photo, src: asset(v.photo.src) }]),
);

export const photoFor = (slug: string): PlacePhoto | undefined => PHOTOS[slug];
