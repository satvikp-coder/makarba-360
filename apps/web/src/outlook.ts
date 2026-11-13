/** Deterministic, explainable signals from the forecast file for a chosen end year. No model, no network. */

export interface Point { year: number; value: number; lo?: number; hi?: number }
export interface Series { id: string; label: string; theme: string; unit: string; good?: "up" | "down" | null; history: Point[]; forecast: Point[] }
export interface ForecastDoc { generated: string; model: string; maxYear: number; region: string; source: string; disclaimer: string; series: Series[] }

export type Momentum = "accelerating" | "slowing" | "reversing" | "steady";
export type Verdict = "improving" | "worsening" | "neutral";
export interface Signal {
  s: Series; from: Point; to: Point; change: number; pct: number | null;
  momentum: Momentum; verdict: Verdict; confidence: "high" | "medium" | "low"; implication: string; impact: { text: string; who: string[]; rightToCity: string };
}

/** History plus the forecast truncated at endYear (TimesFM decodes the horizon in one pass, so a prefix is exact). */
export function upTo(s: Series, endYear: number): Series {
  return { ...s, forecast: s.forecast.filter((p) => p.year <= endYear) };
}

/** Average yearly change over the last `n` points. */
const slope = (pts: Point[], n: number) => {
  const a = pts.slice(-n - 1);
  return a.length < 2 ? 0 : (a[a.length - 1]!.value - a[0]!.value) / (a.length - 1);
};

export function signal(s: Series, endYear: number): Signal | null {
  const f = upTo(s, endYear).forecast;
  const from = s.history[s.history.length - 1], to = f[f.length - 1];
  if (!from || !to) return null;
  const change = to.value - from.value;
  const pct = from.value !== 0 && !s.unit.startsWith("WGI") ? (change / Math.abs(from.value)) * 100 : null;
  const past = slope(s.history, 10), ahead = slope([from, ...f], f.length);
  const scale = Math.max(Math.abs(past), Math.abs(ahead), 1e-9);
  const momentum: Momentum = Math.sign(past) !== Math.sign(ahead) && Math.abs(past) / scale > 0.15 && Math.abs(ahead) / scale > 0.15 ? "reversing"
    : Math.abs(ahead) > Math.abs(past) * 1.25 ? "accelerating" : Math.abs(ahead) < Math.abs(past) * 0.75 ? "slowing" : "steady";
  // A move smaller than 2% of the level (or 0.05 WGI points) is noise, not a verdict.
  const meaningful = Math.abs(change) > Math.max(Math.abs(from.value) * 0.02, s.unit.startsWith("WGI") ? 0.05 : 0);
  const verdict: Verdict = !s.good || !meaningful ? "neutral" : (change > 0) === (s.good === "up") ? "improving" : "worsening";
  const spread = to.hi !== undefined && to.lo !== undefined ? (to.hi - to.lo) / Math.max(Math.abs(to.value), Math.abs(change), 1e-9) : 0;
  const confidence = spread < 0.25 ? "high" : spread < 0.75 ? "medium" : "low";
  return { s, from, to, change, pct, momentum, verdict, confidence, implication: implicationFor(s.id, change, s.theme), impact: impactFor(s.id, s.theme, change) };
}

export function signals(doc: ForecastDoc, endYear: number): Signal[] {
  return doc.series.map((s) => signal(s, endYear)).filter((x): x is Signal => x !== null);
}

// What a trend could mean for people (livelihoods, who is affected, right to the city): data/content/impacts.json.
import impactsJson from "../../../data/content/impacts.json";
export interface Impact { up: string; down: string; who: string[]; rightToCity: string }
const IMPACTS = impactsJson as unknown as Record<string, Impact> & { themes: Record<string, Impact> };

/** People-centred reading of one series moving up or down; falls back to its theme. */
export function impactFor(id: string, theme: string, change: number): { text: string; who: string[]; rightToCity: string } {
  const i = (IMPACTS[id] as Impact | undefined) ?? IMPACTS.themes[theme] ?? IMPACTS.themes["development"]!;
  return { text: change >= 0 ? i.up : i.down, who: i.who, rightToCity: i.rightToCity };
}
export function implicationFor(id: string, change: number, theme = "development"): string {
  return impactFor(id, theme, change).text;
}

export const fmt = (v: number | undefined | null) => v === undefined || v === null ? "–" : Math.abs(v) >= 1e7 ? `${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 1 })} crore` : v.toLocaleString("en-IN", { maximumSignificantDigits: 4 });
