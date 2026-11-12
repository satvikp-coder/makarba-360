/** Display colour and label per place category. Colour is never the only cue: the category name is always shown as text too. */
export const CATEGORY_STYLE: Record<string, { color: string; label: string }> = {
  heritage: { color: "#9a3b1f", label: "Heritage" },
  market: { color: "#b8641a", label: "Street market" },
  transport: { color: "#1f5f99", label: "Transport" },
  community: { color: "#6b3f8f", label: "Community" },
  open_space: { color: "#2f7a4d", label: "Open space" },
  industry: { color: "#5d5248", label: "Industry" },
};
const FALLBACK = { color: "#163d3b", label: "" };

export const categoryColor = (c: string) => (CATEGORY_STYLE[c] ?? FALLBACK).color;
export const categoryLabel = (c: string) => CATEGORY_STYLE[c]?.label || c;

/** MapLibre expression: the category colour of a feature. */
export function categoryColorExpression(): unknown[] {
  return ["match", ["get", "category"], ...Object.entries(CATEGORY_STYLE).flatMap(([k, v]) => [k, v.color]), FALLBACK.color];
}
