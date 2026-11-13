import { useEffect, useState } from "react";
import { ICON_NAMES, type IconName } from "./Icon.js";
import { fmt, signals, type ForecastDoc, type Signal } from "./outlook.js";
import { ANCHORS } from "./scenario.js";

/**
 * AI insights about what the forecasts could mean for people in Makarba.
 *
 * Speed and reliability (local models are slow: ~11 tokens/s for Ollama gemma on a laptop, faster for Apple's on-device model):
 * - a compact prompt (the strongest ~24 signals plus the people-centred ones that must always be there);
 * - HIGHLIGHTS are short and run in the background; the longer BRIEFING runs only when asked for, and streams;
 * - every call streams, so progress (elapsed time, characters) is always visible, can be cancelled, and has a hard timeout.
 *
 * Highlights are GENERATIVE UI: the model returns structured items (title, body, icon, tone, map anchor, groups affected,
 * indicators); icons and anchors must come from fixed lists, and every number shown beside a highlight is read from the data.
 * Results are cached per (forecast file, end year) and are always labelled AI-generated where shown.
 */

export type Provider = "applefm" | "ollama" | "groq";
export type Tone = "positive" | "negative" | "mixed";
export interface Highlight { id: string; title: string; body: string; icon: IconName; tone: Tone; anchor: keyof typeof ANCHORS; indicators: string[]; who: string[]; right: string }
export interface Progress { startedAt: number; chars: number }
export interface AiEntry {
  status: "idle" | "running" | "done" | "error" | "offline";
  headline?: string;
  highlights?: Highlight[];
  briefing?: string;
  briefingStatus?: "idle" | "running" | "done" | "error";
  provider?: Provider;
  model?: string;
  at?: string;
  error?: string;
  progress?: Progress;
}

const PREF_KEY = "makarba.ai.choice.v1";
const CACHE_PREFIX = "makarba.ai.v3:";
const HIGHLIGHT_ICONS: IconName[] = ["building", "home2", "car", "bus", "thermo", "drop", "leaf", "bolt", "users", "coins", "shield", "heart", "wifi", "school", "factory", "haze", "shop", "landmark", "water", "trend", "chart"];
const TIMEOUT_MS = { highlights: 90_000, briefing: 150_000 };
const STALL_MS = 30_000;   // no new text for this long = give up

export const PROVIDERS: Record<Provider, { label: string; note: string; list: string; models: (d: unknown) => string[] }> = {
  applefm: { label: "Apple Intelligence", note: "Apple's on-device Foundation Model; nothing leaves this Mac. Usually the fastest here.", list: "/applefm/health",
    models: (d) => ((d as { available?: boolean }).available ? ["apple-foundation-model"] : []) },
  ollama: { label: "On-device (Ollama)", note: "Runs on this computer; nothing leaves it. Slower on laptops.", list: "/ollama/api/tags",
    models: (d) => ((d as { models?: { name: string }[] }).models ?? []).map((m) => m.name).filter((n) => !/embed/i.test(n)) },
  groq: { label: "Groq (cloud)", note: "Sends the forecast numbers (no personal data) to Groq's servers. Fast.", list: "/groq/models",
    models: (d) => ((d as { data?: { id: string }[] }).data ?? []).map((m) => m.id).filter((id) => !/whisper|tts|guard|embed|orpheus|playai/i.test(id)).sort() },
};

export function getChoice(): { provider: Provider; model: string } | null {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? "null"); } catch { return null; }
}
export function setChoice(c: { provider: Provider; model: string }) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export async function listModels(p: Provider): Promise<string[]> {
  try {
    const r = await fetch(PROVIDERS[p].list, { signal: AbortSignal.timeout?.(4000) });
    return r.ok ? PROVIDERS[p].models(await r.json()) : [];
  } catch { return []; }
}
// fastest suitable model first
const preferred = (models: string[]) => models.find((m) => /apple|llama-3\.3-70b|gpt-oss-120b/i.test(m)) ?? models.find((m) => /gemma3n|gemma4|gemma|qwen|llama/i.test(m)) ?? models[0] ?? "";

/**
 * First available provider: Apple's on-device model, then Ollama; the visitor's saved choice wins. Background (unasked) runs never
 * use the cloud unless the visitor chose Groq before: forecast numbers are only sent off the device on request.
 */
export async function pickProvider(background = false): Promise<{ provider: Provider; model: string } | null> {
  const saved = getChoice();
  const order: Provider[] = ["applefm", "ollama", "groq"];
  if (saved) order.sort((a, b) => (a === saved.provider ? -1 : b === saved.provider ? 1 : 0));
  if (background && saved?.provider !== "groq") order.splice(order.indexOf("groq"), 1);
  for (const p of order) {
    const models = await listModels(p);
    if (models.length) return { provider: p, model: saved?.provider === p && models.includes(saved.model) ? saved.model : preferred(models) };
  }
  return null;
}

// --- store ------------------------------------------------------------------------------------------------------------------
const entries = new Map<string, AiEntry>();
const subs = new Set<() => void>();
const aborts = new Map<string, AbortController>();
const notify = () => subs.forEach((f) => f());
const keyOf = (doc: ForecastDoc, year: number) => `${doc.generated}:${doc.series.length}:${year}`;

function readCache(k: string): AiEntry | null {
  try { const v = JSON.parse(localStorage.getItem(CACHE_PREFIX + k) ?? "null") as AiEntry | null; return v?.highlights?.length ? { ...v, status: "done", progress: undefined } : null; } catch { return null; }
}
function writeCache(k: string, e: AiEntry) {
  try { localStorage.setItem(CACHE_PREFIX + k, JSON.stringify({ ...e, progress: undefined })); } catch { /* quota: keep in memory only */ }
}
function put(k: string, e: AiEntry) { entries.set(k, e); notify(); }
const cur = (k: string): AiEntry => entries.get(k) ?? readCache(k) ?? { status: "idle" };

export function getAi(doc: ForecastDoc | null, year: number): AiEntry {
  return doc ? cur(keyOf(doc, year)) : { status: "idle" };
}
function useTick() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
}
export function useAi(doc: ForecastDoc | null, year: number): AiEntry { useTick(); if (doc) void loadBundled(doc); return getAi(doc, year); }
/** Any generation in progress anywhere (drives the thinking orb in the shell). */
export function useAiBusy(): boolean { useTick(); return [...entries.values()].some((e) => e.status === "running" || e.briefingStatus === "running"); }

export function cancelAi(doc: ForecastDoc, year: number) {
  const k = keyOf(doc, year);
  aborts.get(k)?.abort(new Error("was cancelled"));
  aborts.delete(k);
  const e = cur(k);
  put(k, { ...e, status: e.highlights?.length ? "done" : "idle", briefingStatus: e.briefing ? "done" : "idle", progress: undefined });
}

// --- prompts ----------------------------------------------------------------------------------------------------------------
/** Indicators that speak most directly to livelihoods and the right to the city: always in the prompt when present. */
const MUST = ["WEATHER_AHD_HOTDAYS", "KAGGLE_AHD_PM2.5", "SL.EMP.SELF.ZS", "SP.URB.TOTL.IN.ZS", "FP.CPI.TOTL.ZG", "SL.TLF.CACT.FE.ZS", "SH.STA.TRAF.P5", "EG.FEC.RNEW.ZS", "NY.GDP.PCAP.CD", "SL.UEM.TOTL.ZS"];
export function compactSignals(sig: Signal[], n = 24): Signal[] {
  const must = sig.filter((x) => MUST.includes(x.s.id) && x.s.theme !== "markets");
  const rest = sig.filter((x) => !MUST.includes(x.s.id) && x.s.theme !== "markets").sort((a, b) => Math.abs(b.pct ?? b.change * 50) - Math.abs(a.pct ?? a.change * 50));
  return [...must, ...rest].slice(0, n);
}

const lines = (sig: Signal[]) => sig.map((x) => `${x.s.id}|${x.s.label}|${fmt(x.from.value)}→${fmt(x.to.value)} ${x.s.unit}|${x.verdict}`).join("\n");
const CONTEXT = (year: number) => `Makarba: a fast-growing peri-urban ward on the south-west edge of Ahmedabad, India, beside the Sarkhej–Gandhinagar Highway, the 15th-century Sarkhej Roza and its lake, and a canal; street vendors, auto drivers, construction and domestic workers, long-time village residents and new apartment dwellers live side by side. Forecasts (Google TimesFM) to ${year}; ids starting KAGGLE_AHD/WEATHER_AHD are Ahmedabad city data, the rest are national India. Not Makarba measurements. Audience: students of social and political science. Focus on people, livelihoods, fairness and access to the city (who can live, work, move and be heard here).`;

/** JSON schema for Ollama structured outputs (constrained decoding: always valid, compact JSON). */
export const HIGHLIGHT_SCHEMA = {
  type: "object", required: ["headline", "highlights"],
  properties: {
    headline: { type: "string" },
    highlights: { type: "array", minItems: 4, maxItems: 4, items: { type: "object", required: ["title", "body", "who", "right", "icon", "tone", "anchor", "indicators"], properties: {
      title: { type: "string" }, body: { type: "string" }, who: { type: "array", items: { type: "string" } }, right: { type: "string" },
      icon: { type: "string", enum: HIGHLIGHT_ICONS }, tone: { type: "string", enum: ["positive", "negative", "mixed"] },
      anchor: { type: "string", enum: Object.keys(ANCHORS) }, indicators: { type: "array", items: { type: "string" } } } } },
  },
};

// The task line is worded for Apple's on-device guardrail: "pick the most important impacts ... which groups face costs" is refused
// with this data, while "balanced highlights for a class discussion ... who could gain or lose out" is accepted (checked 2026-11-12).
// Short field limits keep the answer near 450 tokens, which is most of the generation time on local models.
export function highlightsPrompt(sig: Signal[], year: number): string {
  return `${CONTEXT(year)}
Write 4 short, balanced highlights for a class discussion: how these trends could change daily life and work in Makarba by ${year}, and who could gain or lose out.
Reply with JSON only: {"headline":"<=70 chars","highlights":[{"title":"<=36 chars","body":"<=110 chars, plain words, 'could'/'may', no digits","who":["2-3 groups, e.g. street vendors"],"right":"<=70 chars: the right-to-the-city question","icon":"one of ${HIGHLIGHT_ICONS.join("|")}","tone":"positive|negative|mixed","anchor":"one of ${Object.keys(ANCHORS).join("|")}","indicators":["1-2 ids from the list"]}]}
Forecasts (id|label|now→${year}|direction):
${lines(sig)}`;
}

export function briefingPrompt(sig: Signal[], year: number): string {
  return `${CONTEXT(year)}
Write a short briefing (max 200 words) with these headings:
**Big picture**; **Livelihoods** (3 bullets: which groups benefit, which face costs, which work changes); **Right to the city** (2 bullets: housing, public space, voice); **Questions for discussion** (2 bullets).
Use only the numbers given. Say "could" or "may", never "will". Mention once that these are national and city trends.
${lines(sig)}`;
}

// --- transport (always streamed, so progress is visible and stalls are caught) -------------------------------------------
async function call(provider: Provider, model: string, prompt: string, opts: { json: boolean; signal: AbortSignal; maxTokens: number; onText: (all: string) => void }): Promise<string> {
  const { json, signal, maxTokens } = opts;
  if (provider === "applefm" && json) {
    // Apple's guided generation with the highlights schema: always-valid JSON, returned in one piece
    const r = await fetch("/applefm/generate", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, stream: false, schema: "highlights" }) });
    const j = await r.json().catch(() => ({})) as { response?: string; error?: string };
    if (!r.ok || !j.response) throw new Error(j.error ? `Apple Intelligence declined (${j.error})` : `the model service answered ${r.status}`);
    opts.onText(j.response);
    return j.response;
  }
  const r = provider === "applefm"
    ? await fetch("/applefm/generate", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, stream: true, json }) })
    : provider === "ollama"
    ? await fetch("/ollama/api/generate", { method: "POST", signal, headers: { "Content-Type": "application/json" },
        // think:false skips hidden reasoning tokens; keep_alive keeps the model loaded between calls
        body: JSON.stringify({ model, prompt, stream: true, think: false, keep_alive: "30m", ...(json ? { format: HIGHLIGHT_SCHEMA } : {}), options: { temperature: json ? 0.2 : 0.4, num_ctx: 4096, num_predict: maxTokens } }) })
    : await fetch("/groq/chat/completions", { method: "POST", signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, stream: true, temperature: json ? 0.2 : 0.4, max_tokens: maxTokens, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "user", content: prompt }] }) });
  if (!r.ok || !r.body) throw new Error(`the model service answered ${r.status}`);
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "", all = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const ls = buf.split("\n"); buf = ls.pop() ?? "";
    for (const raw of ls) {
      const l = provider === "groq" ? raw.replace(/^data:\s*/, "").trim() : raw.trim();
      if (!l || l === "[DONE]") continue;
      let j: { response?: string; replace?: boolean; error?: string; choices?: { delta?: { content?: string } }[] };
      try { j = JSON.parse(l); } catch { continue; }
      if (j.error) throw new Error(j.error);
      const t = provider === "groq" ? j.choices?.[0]?.delta?.content : j.response;
      if (t) { all = j.replace ? t : all + t; opts.onText(all); }
    }
  }
  return all;
}

/** Runs one streamed call with a hard timeout and a stall timeout, both surfacing as readable errors. */
/** Runs one model call with an overall time limit, and (for streamed answers) a stall limit; stallMs 0 = the answer arrives in one piece. */
async function guarded<T>(k: string, ms: number, run: (signal: AbortSignal, onChunk: () => void) => Promise<T>, stallMs = STALL_MS): Promise<T> {
  const ac = new AbortController();
  aborts.get(k)?.abort(new Error("was replaced by a newer request"));
  aborts.set(k, ac);
  let last = Date.now();
  const hard = setTimeout(() => ac.abort(new Error(`took longer than ${Math.round(ms / 1000)} s`)), ms);
  const stall = stallMs ? setInterval(() => { if (Date.now() - last > stallMs) ac.abort(new Error(`stopped responding for ${stallMs / 1000} s`)); }, 2000) : undefined;
  try {
    return await run(ac.signal, () => { last = Date.now(); });
  } catch (e) {
    const reason = ac.signal.aborted && ac.signal.reason instanceof Error ? ac.signal.reason.message : null;
    throw new Error(reason ? `The model ${reason}` : e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(hard); clearInterval(stall);
    if (aborts.get(k) === ac) aborts.delete(k);
  }
}

/** Validates and cleans the model's highlights; anything outside the fixed lists is dropped, so the UI can trust every field. */
// Models often repeat the right-to-the-city line inside the body and prefix it with its own label; the UI labels it already.
const RIGHT_LEAD_IN = /\s*The right[- ]to[- ]the[- ]city( question)?\b.*$/i;
/** Whole sentences up to n characters (never a word cut in half). */
const sentences = (t: string, n: number) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > n * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};
/** "The right-to-the-city question: who controls the streets" -> "Who controls the streets?" */
const question = (t: string) => {
  const q = t.replace(/^(the\s+)?right[- ]to[- ]the[- ]city( question)?\s*[:\-–]\s*/i, "").trim();
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
  const o = j as { headline?: unknown; highlights?: unknown };
  if (!Array.isArray(o.highlights)) return null;
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const noNums = (t: string) => t
    .replace(/\s*\b(by|in|until|to|from|around|after|before)\s+(the\s+year\s+)?\d{4}\b/gi, "")   // whole year phrases, not a dangling "by"
    .replace(/\d[\d,.]*\s*%?/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  const seen = new Set<string>();
  const list: Highlight[] = [];
  for (const h of o.highlights as Record<string, unknown>[]) {
    const anchor = String(h["anchor"] ?? "") as keyof typeof ANCHORS;
    const icon = String(h["icon"] ?? "") as IconName;
    const title = clip(h["title"], 48), body = sentences(noNums(clip(h["body"], 600).replace(RIGHT_LEAD_IN, "")), 200);
    if (!title || !body || !(anchor in ANCHORS)) continue;
    const key = `${anchor}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      id: `h${list.length + 1}`, title, body,
      icon: ICON_NAMES.includes(icon) ? icon : "spark",
      tone: h["tone"] === "positive" || h["tone"] === "negative" ? h["tone"] : "mixed",
      anchor,
      indicators: (Array.isArray(h["indicators"]) ? h["indicators"] : []).map(String).filter((id) => validIds.has(id)).slice(0, 3),
      who: (Array.isArray(h["who"]) ? h["who"] : []).map((w) => clip(w, 32)).filter(Boolean).slice(0, 3),
      right: question(noNums(clip(h["right"], 160))),
    });
    if (list.length === 6) break;
  }
  return list.length >= 2 ? { headline: clip(o.headline, 110), highlights: list } : null;
}

// --- orchestration ----------------------------------------------------------------------------------------------------------
const running = new Map<string, Promise<void>>();

/** Highlights for this year (short, background-friendly). Cached results return at once; concurrent calls share one run. */
function runHighlights(doc: ForecastDoc, year: number, opts: { force?: boolean; background?: boolean; choice?: { provider: Provider; model: string } } = {}): Promise<void> {
  const k = keyOf(doc, year);
  if (!opts.force && cur(k).highlights?.length) { if (!entries.has(k)) entries.set(k, cur(k)); return Promise.resolve(); }
  if (running.has(k) && !opts.force) return running.get(k)!;
  const job = (async () => {
    // the chosen provider first, then every other available one (so a refusal or failure falls through instead of stopping)
    const first = opts.choice ?? await pickProvider(opts.background);
    if (!first) { put(k, { ...cur(k), status: "offline" }); return; }
    if (opts.choice) setChoice(opts.choice);
    const chain: { provider: Provider; model: string }[] = [first];
    for (const p of ["applefm", "ollama"] as Provider[]) if (p !== first.provider && !opts.choice) { const m = await listModels(p); if (m.length) chain.push({ provider: p, model: preferred(m) }); }
    const sig = compactSignals(signals(doc, year));
    const ids = new Set(sig.map((x) => x.s.id));
    let lastError = "";
    for (const choice of chain) {
      const startedAt = Date.now();
      put(k, { ...cur(k), status: "running", provider: choice.provider, model: choice.model, error: undefined, progress: { startedAt, chars: 0 } });
      try {
        const parsed = await guarded(k, TIMEOUT_MS.highlights, async (signal, onChunk) => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const raw = await call(choice.provider, choice.model, highlightsPrompt(sig, year), { json: true, signal, maxTokens: 700,
              onText: (all) => { onChunk(); put(k, { ...cur(k), progress: { startedAt, chars: all.length } }); } });
            const p = parseHighlights(raw, ids);
            if (p) return p;
          }
          throw new Error("The model's answer could not be read");
        // Apple's guided generation is not streamed (one JSON answer after ~25-35 s): only the overall limit applies, or the stall
        // guard would cut it off just before it finishes and fall back to a slower model
        }, choice.provider === "applefm" ? 0 : STALL_MS);
        const done: AiEntry = { ...cur(k), status: "done", headline: parsed.headline, highlights: parsed.highlights, at: new Date().toISOString(), progress: undefined };
        put(k, done);
        writeCache(k, done);
        return;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (/cancelled/.test(lastError)) break;
      }
    }
    put(k, { ...cur(k), status: "error", error: lastError, progress: undefined });
  })().finally(() => running.delete(k));
  running.set(k, job);
  return job;
}

/** The longer written briefing: only when asked for, streamed so text appears as it is written. */
function runBriefing(doc: ForecastDoc, year: number, opts: { force?: boolean; choice?: { provider: Provider; model: string } } = {}): Promise<void> {
  const k = keyOf(doc, year);
  if (!opts.force && cur(k).briefingStatus === "done" && cur(k).briefing) return Promise.resolve();
  if (cur(k).briefingStatus === "running" && !opts.force) return Promise.resolve();
  return (async () => {
    const choice = opts.choice ?? await pickProvider(false);
    if (!choice) { put(k, { ...cur(k), briefingStatus: "error", error: "No AI model is available" }); return; }
    if (opts.choice) setChoice(opts.choice);
    const sig = compactSignals(signals(doc, year));
    const startedAt = Date.now();
    put(k, { ...cur(k), briefing: "", briefingStatus: "running", provider: choice.provider, model: choice.model, error: undefined, progress: { startedAt, chars: 0 } });
    try {
      const text = await guarded(k, TIMEOUT_MS.briefing, (signal, onChunk) => call(choice.provider, choice.model, briefingPrompt(sig, year), { json: false, signal, maxTokens: 520,
        onText: (all) => { onChunk(); put(k, { ...cur(k), briefing: all, progress: { startedAt, chars: all.length } }); } }));
      const done: AiEntry = { ...cur(k), briefing: text, briefingStatus: "done", at: new Date().toISOString(), progress: undefined };
      put(k, done);
      if (done.highlights?.length) writeCache(k, done);
    } catch (e) {
      put(k, { ...cur(k), briefingStatus: "error", error: e instanceof Error ? e.message : String(e), progress: undefined });
    }
  })();
}

// --- pre-generated insights ------------------------------------------------------------------------------------------------
// The forecast years are fixed, so tools/pregen-ai.ts writes every year's highlights and briefing ahead of time (data/ai/insights.json,
// Apple's on-device model). They are used at once when they were made from the same forecast file; anything missing is generated
// live, and "Regenerate" always asks a model afresh. They are still AI-generated and labelled so.
interface Bundled { forecast: string; series: number; provider: Provider; model: string; at: string; years: Record<string, { headline: string; highlights: unknown[]; briefing?: string }> }
let bundled: Promise<void> | null = null;
export function loadBundled(doc: ForecastDoc, url = "/ai/insights.json"): Promise<void> {
  return (bundled ??= fetch(url).then((r) => (r.ok ? r.json() as Promise<Bundled> : null)).then((j) => {
    // the optional markets file adds series locally, but markets never reach the prompts: compare the forecast series only
    const forecastSeries = doc.series.filter((x) => x.theme !== "markets").length;
    if (!j || j.forecast !== doc.generated || j.series !== forecastSeries || !j.years) return;
    const ids = new Set(doc.series.map((x) => x.id));
    for (const [y, v] of Object.entries(j.years)) {
      const k = keyOf(doc, Number(y));
      if (cur(k).highlights?.length) continue;   // a visitor's own newer answer wins
      const p = parseHighlights(JSON.stringify({ headline: v.headline, highlights: v.highlights }), ids);
      if (!p) continue;
      entries.set(k, { status: "done", headline: p.headline, highlights: p.highlights, briefing: v.briefing, briefingStatus: v.briefing ? "done" : "idle", provider: j.provider, model: `${PROVIDERS[j.provider]?.label ?? j.model}, pre-generated`, at: j.at });
    }
    notify();
  }).catch(() => undefined));
}
/** For tests: forget the loaded file. */
export function resetBundled() { bundled = null; }

/** Highlights for this year (short, background-friendly): pre-generated ones at once, cached ones at once, otherwise generated. */
export function ensureAi(doc: ForecastDoc, year: number, opts: { force?: boolean; background?: boolean; choice?: { provider: Provider; model: string } } = {}): Promise<void> {
  return opts.force ? runHighlights(doc, year, opts) : loadBundled(doc).then(() => runHighlights(doc, year, opts));
}
/** The longer briefing, on request: pre-generated when available, otherwise streamed from a model. */
export function ensureBriefing(doc: ForecastDoc, year: number, opts: { force?: boolean; choice?: { provider: Provider; model: string } } = {}): Promise<void> {
  return opts.force ? runBriefing(doc, year, opts) : loadBundled(doc).then(() => runBriefing(doc, year, opts));
}
