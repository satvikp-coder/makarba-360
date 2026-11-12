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
/** Okabe–Ito colours, safe for the common colour-vision deficiencies (used when the "Colour-blind safe" setting is on). */
const CVD: Record<string, string> = { heritage: "#D55E00", market: "#E69F00", transport: "#0072B2", community: "#CC79A7", open_space: "#009E73", industry: "#555555" };
const cvdOn = () => typeof document !== "undefined" && document.documentElement.dataset["palette"] === "cvd";

export const categoryColor = (c: string) => (cvdOn() ? CVD[c] : undefined) ?? (CATEGORY_STYLE[c] ?? FALLBACK).color;
/** Icon per category, from the shared hairline set. */
export const CATEGORY_ICON: Record<string, "landmark" | "shop" | "bus" | "users" | "leaf" | "factory"> = {
  heritage: "landmark", market: "shop", transport: "bus", community: "users", open_space: "leaf", industry: "factory",
};
/** Scenario colours for rebuilt blocks and rooftop solar, per palette. */
export const scenarioColors = () => (cvdOn() ? { rebuilt: "#E69F00", solar: "#0072B2" } : { rebuilt: "#D9894F", solar: "#3d6fb5" });
export const categoryLabel = (c: string) => CATEGORY_STYLE[c]?.label || c;

/** MapLibre expression: the category colour of a feature. */
export function categoryColorExpression(): unknown[] {
  return ["match", ["get", "category"], ...Object.keys(CATEGORY_STYLE).flatMap((k) => [k, categoryColor(k)]), FALLBACK.color];
}
