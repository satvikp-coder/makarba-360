import { formatDated, type Dated } from "./api.js";

export interface PairInput {
  id: string; beforeDate: Dated; afterDate: Dated; sourceIds: string[]; matchingViewpointNotes: string; evidenceQuality: string;
}
export interface PairView {
  eligible: boolean;
  /** Why the pair is hidden when not eligible (for logs/tests; never shown as a claim). */
  reason?: string;
  beforeLabel: string; afterLabel: string;
  /** "matched" only when the record documents a matched viewpoint; otherwise an explicit not-same-angle label. */
  viewpoint: "matched" | "not-matched";
  viewpointText: string;
  quality: string;
  textAlternative: string;
}

const unknownish = (d: Dated) => d.value === null || d.value === undefined || d.value === "" || d.precision === "unknown";

/**
 * Decides whether and how a comparison may be shown (issue #18). A pair needs two known dates, at least one
 * source and both images; an unknown date is never rendered as an exact one; the "same angle" claim needs a
 * documented matching note. The text alternative is always produced so the slider is never the only path.
 */
export function viewPair(p: PairInput, bothMediaAvailable: boolean): PairView {
  const base = { beforeLabel: formatDated(p.beforeDate), afterLabel: formatDated(p.afterDate), quality: p.evidenceQuality };
  const matched = p.matchingViewpointNotes.trim().length > 0 && !/not matched|unmatched|different/i.test(p.matchingViewpointNotes);
  const viewpointText = matched ? `Matched viewpoint: ${p.matchingViewpointNotes}` : "These photographs are not documented as taken from the same viewpoint, so differences may come from the angle.";
  const common = { ...base, viewpoint: matched ? ("matched" as const) : ("not-matched" as const), viewpointText };
  const text = `Before: ${base.beforeLabel}. After: ${base.afterLabel}. Evidence quality: ${p.evidenceQuality}. ${viewpointText}`;
  if (unknownish(p.beforeDate) || unknownish(p.afterDate)) return { ...common, eligible: false, reason: "unknown date", textAlternative: text };
  if (p.sourceIds.length === 0) return { ...common, eligible: false, reason: "no source", textAlternative: text };
  if (!bothMediaAvailable) return { ...common, eligible: false, reason: "media unavailable", textAlternative: text };
  return { ...common, eligible: true, textAlternative: text };
}

/** Slider value 0..100 moved by keyboard: arrows 5, PageUp/Down 25, Home/End to the ends. Returns null for other keys. */
export function sliderKey(value: number, key: string): number | null {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  switch (key) {
    case "ArrowRight": case "ArrowUp": return clamp(value + 5);
    case "ArrowLeft": case "ArrowDown": return clamp(value - 5);
    case "PageUp": return clamp(value + 25);
    case "PageDown": return clamp(value - 25);
    case "Home": return 0;
    case "End": return 100;
    default: return null;
  }
}
