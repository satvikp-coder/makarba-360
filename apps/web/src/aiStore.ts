import { useEffect, useState } from "react";
import { ICON_NAMES, type IconName } from "./Icon.js";
import type { ForecastDoc } from "./outlook.js";
import { ANCHORS } from "./scenario.js";

/**
 * AI insights about what the forecasts could mean for people in Makarba, read from data/ai/insights.json (written ahead of time by
 * tools/pregen-ai.ts). The site never calls a model. Highlights are generative UI: structured items whose icon and map anchor must
 * come from fixed lists, so every field is validated here before it is shown. Everything from this store is labelled AI-generated.
 */

export type Tone = "positive" | "negative" | "mixed";
export interface Highlight { id: string; title: string; body: string; fullBody?: string; icon: IconName; tone: Tone; anchor: keyof typeof ANCHORS; indicators: string[]; who: string[]; right: string }
export interface AiEntry {
  /** loading: the file has not arrived yet; none: no insights for this year (or the file was made from different forecasts). */
  status: "loading" | "done" | "none";
  headline?: string;
  highlights?: Highlight[];
  briefing?: string;
}

// Include the actual forecast contents, not just the date: forecasts can be regenerated on the same day.
const fingerprints = new WeakMap<ForecastDoc, string>();
export function forecastFingerprint(doc: ForecastDoc): string {
  const existing = fingerprints.get(doc);
  if (existing) return existing;
  const input = JSON.stringify(doc.series.filter((s) => s.theme !== "markets"));
  let a = 2166136261, b = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 16777619);
    b = Math.imul(b ^ input.charCodeAt(i), 2246822519);
  }
  const result = `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
  fingerprints.set(doc, result);
  return result;
}

// --- validation and cleanup of model output ---------------------------------------------------------------------------------
// Models often repeat the right-to-the-city line inside the body and prefix it with its own label; the UI labels it already.
const RIGHT_LEAD_IN = /\s*The right[- ]to[- ]the[- ]city( question)?\b.*$/i;
/** Ends the text as a sentence: models sometimes stop on a comma or dash, or leave the full stop off. */
const finish = (t: string) => { const s = t.replace(/[\s,;:—–-]+$/, ""); return !s || /[.!?…]$/.test(s) ? s : `${s}.`; };
/** Whole sentences up to n characters (never a word cut in half). */
const sentences = (t: string, n: number) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > n * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};
/** "The right-to-the-city question: who controls the streets" -> "Who controls the streets?" */
const question = (t: string) => {
  const q = t.replace(/^(the\s+)?right[- ]to[- ]the[- ]city( question)?\s*[:,\-–]\s*/i, "").trim();
  if (!q) return "";
  const c = q[0]!.toUpperCase() + q.slice(1);
  return /^(who|whose|what|how|can|will|does|do|is|are|where|which|should)\b/i.test(c) && !/[?.!]$/.test(c) ? `${c}?` : c;
};
export function parseHighlights(raw: string, validIds: Set<string>): { headline: string; highlights: Highlight[] } | null {
  let j: unknown;
  const body = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try { j = JSON.parse(body); } catch {
    // small models sometimes drop the opening quote of a key (`,icon":`): repair that once before giving up
    try { j = JSON.parse(body.replace(/([,{]\s*)([A-Za-z_]+)":/g, '$1"$2":')); } catch { return null; }
  }
  if (!j || typeof j !== "object") return null;
  const o = j as { headline?: unknown; highlights?: unknown };
  if (!Array.isArray(o.highlights)) return null;
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const noNums = (t: string) => t
    .replace(/\s*\b(by|in|until|to|from|around|after|before)\s+(the\s+year\s+)?\d{4}\b/gi, "")   // whole year phrases, not a dangling "by"
    .replace(/\d[\d,.]*\s*%?/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  const seen = new Set<string>();
  const list: Highlight[] = [];
  for (const h of o.highlights as Record<string, unknown>[]) {
    if (!h || typeof h !== "object") continue;
    const anchor = String(h["anchor"] ?? "") as keyof typeof ANCHORS;
    const icon = String(h["icon"] ?? "") as IconName;
    const title = clip(h["title"], 400), fullBody = finish(noNums(clip(h["fullBody"] ?? h["body"], 4000).replace(RIGHT_LEAD_IN, ""))), body = sentences(fullBody, 200);
    if (!title || !body || !(anchor in ANCHORS)) continue;
    const key = `${anchor}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      id: `h${list.length + 1}`, title, body, ...(fullBody !== body ? { fullBody } : {}),
      icon: ICON_NAMES.includes(icon) ? icon : "spark",
      tone: h["tone"] === "positive" || h["tone"] === "negative" ? h["tone"] : "mixed",
      anchor,
      indicators: (Array.isArray(h["indicators"]) ? h["indicators"] : []).map(String).filter((id) => validIds.has(id)).slice(0, 3),
      who: (Array.isArray(h["who"]) ? h["who"] : []).map((w) => clip(w, 400)).filter(Boolean).slice(0, 3),
      right: question(noNums(clip(h["right"], 1000))),
    });
    if (list.length === 6) break;
  }
  return list.length >= 2 ? { headline: clip(o.headline, 1000), highlights: list } : null;
}

// --- the stored insights ----------------------------------------------------------------------------------------------------
interface Stored { fingerprint: string; years: Record<string, { headline: string; highlights: unknown[]; briefing?: string }> }
const loaded = new Map<string, Promise<Map<number, AiEntry>>>();
const ready = new Map<string, Map<number, AiEntry>>();
const subs = new Set<() => void>();

export function loadInsights(doc: ForecastDoc, url = "/ai/insights.json"): Promise<Map<number, AiEntry>> {
  const fingerprint = forecastFingerprint(doc);
  const previous = loaded.get(fingerprint);
  if (previous) return previous;
  // A missing file (4xx) is a settled answer; a network error, server error or unreadable body may pass, so it is not remembered.
  let transient = false;
  const job = fetch(url).then((r) => { if (!r.ok) { transient = r.status >= 500; return null; } return r.json() as Promise<Stored>; })
    .catch(() => { transient = true; return null; }).then((j) => {
    const years = new Map<number, AiEntry>();
    if (j?.fingerprint === fingerprint && j.years && typeof j.years === "object") {
      const ids = new Set(doc.series.map((x) => x.id));
      for (const [y, v] of Object.entries(j.years)) {
        if (!v || typeof v !== "object") continue;
        const p = parseHighlights(JSON.stringify({ headline: v.headline, highlights: v.highlights }), ids);
        if (p) years.set(Number(y), { status: "done", ...p, ...(typeof v.briefing === "string" && v.briefing.trim() ? { briefing: v.briefing } : {}) });
      }
    }
    if (transient) loaded.delete(fingerprint);
    ready.set(fingerprint, years);
    subs.forEach((f) => f());
    return years;
  });
  loaded.set(fingerprint, job);
  return job;
}

export function getAi(doc: ForecastDoc | null, year: number): AiEntry {
  if (!doc) return { status: "loading" };
  const years = ready.get(forecastFingerprint(doc));
  return years ? years.get(year) ?? { status: "none" } : { status: "loading" };
}
export function useAi(doc: ForecastDoc | null, year: number): AiEntry {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  useEffect(() => { if (doc) void loadInsights(doc); }, [doc]);
  return getAi(doc, year);
}
/** For tests: forget the loaded file. */
export function resetInsights() { loaded.clear(); ready.clear(); }
