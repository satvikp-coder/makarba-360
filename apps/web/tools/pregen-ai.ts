/**
 * Writes the AI highlights and briefing for every forecast year to data/ai/insights.json, which the site reads as-is (the hosted
 * site never calls a model). The file is tied to the forecast contents it was made from: after `./run.sh forecast`, run this again.
 * Run:  ./run.sh insights   (macOS 26+ with Apple Intelligence; it starts the local bridge in tools/applefm).
 * Years already in the file for the same forecasts are kept; delete the file to make every year afresh. Years that fail are left out.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { forecastFingerprint, parseHighlights } from "../src/aiStore.js";
import { fmt, signals, type ForecastDoc, type Signal } from "../src/outlook.js";
import { ANCHORS } from "../src/scenario.js";

const ROOT = resolve(process.cwd(), "../..");
const OUT = resolve(ROOT, "data/ai/insights.json");
const BRIDGE = process.env.APPLEFM_HOST ?? "http://127.0.0.1:11535";
const doc = JSON.parse(readFileSync(resolve(ROOT, "data/forecasts.json"), "utf8")) as ForecastDoc;

const HIGHLIGHT_ICONS = ["building", "home2", "car", "bus", "thermo", "drop", "leaf", "bolt", "users", "coins", "shield", "heart", "wifi", "school", "factory", "haze", "shop", "landmark", "water", "trend", "chart"];
/** Indicators that speak most directly to livelihoods and the right to the city: always in the prompt when present. */
const MUST = ["WEATHER_AHD_HOTDAYS", "KAGGLE_AHD_PM2.5", "SL.EMP.SELF.ZS", "SP.URB.TOTL.IN.ZS", "FP.CPI.TOTL.ZG", "SL.TLF.CACT.FE.ZS", "SH.STA.TRAF.P5", "EG.FEC.RNEW.ZS", "NY.GDP.PCAP.CD", "SL.UEM.TOTL.ZS"];
/** A compact prompt: the people-centred indicators plus the strongest other signals. */
function compactSignals(sig: Signal[], n = 24): Signal[] {
  const must = sig.filter((x) => MUST.includes(x.s.id) && x.s.theme !== "markets");
  const rest = sig.filter((x) => !MUST.includes(x.s.id) && x.s.theme !== "markets").sort((a, b) => Math.abs(b.pct ?? b.change * 50) - Math.abs(a.pct ?? a.change * 50));
  return [...must, ...rest].slice(0, n);
}
const lines = (sig: Signal[]) => sig.map((x) => `${x.s.id}|${x.s.label}|${fmt(x.from.value)}→${fmt(x.to.value)} ${x.s.unit}|${x.verdict}`).join("\n");
const CONTEXT = (year: number) => `Makarba: a fast-growing peri-urban ward on the south-west edge of Ahmedabad, India, beside the Sarkhej–Gandhinagar Highway, the 15th-century Sarkhej Roza and its lake, and a canal; street vendors, auto drivers, construction and domestic workers, long-time village residents and new apartment dwellers live side by side. Forecasts (Google TimesFM) to ${year}; ids starting KAGGLE_AHD/WEATHER_AHD are Ahmedabad city data, the rest are national India. Not Makarba measurements. Audience: students of social and political science. Focus on people, livelihoods, fairness and access to the city (who can live, work, move and be heard here).`;

// The task line is worded for Apple's on-device guardrail: "pick the most important impacts ... which groups face costs" is refused
// with this data, while "balanced highlights for a class discussion ... who could gain or lose out" is accepted (checked 2026-11-12).
const highlightsPrompt = (sig: Signal[], year: number) => `${CONTEXT(year)}
Write 4 short, balanced highlights for a class discussion: how these trends could change daily life and work in Makarba by ${year}, and who could gain or lose out.
Reply with JSON only: {"headline":"<=70 chars","highlights":[{"title":"<=36 chars","body":"<=110 chars, plain words, 'could'/'may', no digits","who":["2-3 groups, e.g. street vendors"],"right":"<=70 chars: the right-to-the-city question","icon":"one of ${HIGHLIGHT_ICONS.join("|")}","tone":"positive|negative|mixed","anchor":"one of ${Object.keys(ANCHORS).join("|")}","indicators":["1-2 ids from the list"]}]}
Forecasts (id|label|now→${year}|direction):
${lines(sig)}`;

const briefingPrompt = (sig: Signal[], year: number) => `${CONTEXT(year)}
Write a short briefing (max 200 words) with these headings:
**Big picture**; **Livelihoods** (3 bullets: which groups benefit, which face costs, which work changes); **Right to the city** (2 bullets: housing, public space, voice); **Questions for discussion** (2 bullets).
Use only the numbers given. Say "could" or "may", never "will". Mention once that these are national and city trends.
${lines(sig)}`;

async function ask(prompt: string, schema?: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r: Response;
    try {
      r = await fetch(`${BRIDGE}/generate`, { method: "POST", signal: AbortSignal.timeout(120_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, stream: false, ...(schema ? { schema } : {}) }) });
    } catch (e) { console.log(`  retry (${e instanceof Error ? e.name : e})`); continue; }
    const j = await r.json().catch(() => ({})) as { response?: string; error?: string };
    if (r.ok && j.response) return j.response;
    console.log(`  retry (${j.error ?? r.status})`);
  }
  throw new Error("no answer");
}

it("writes AI insights for every forecast year", async () => {
  const first = new Date().getFullYear() + 1, last = doc.maxYear ?? 2050;
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const fingerprint = forecastFingerprint(doc);
  const years = (prev?.fingerprint === fingerprint ? prev.years : {}) as Record<string, unknown>;
  const out = { _about: "AI-generated from the TimesFM forecasts; may be wrong. Made by apps/web/tools/pregen-ai.ts.", forecast: doc.generated, fingerprint, years };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  for (let year = first; year <= last; year++) {
    if (years[year]) continue;
    const t = Date.now();
    try {
      const sig = compactSignals(signals(doc, year));
      const parsed = parseHighlights(await ask(highlightsPrompt(sig, year), "highlights"), new Set(sig.map((x) => x.s.id)));
      if (!parsed) throw new Error("unreadable highlights");
      years[year] = { ...parsed, briefing: await ask(briefingPrompt(sig, year)) };
      writeFileSync(OUT, JSON.stringify(out, null, 1));   // save as we go: an interrupted run keeps what it made
      console.log(`${year} ok in ${((Date.now() - t) / 1000).toFixed(0)} s`);
    } catch (e) { console.log(`${year} skipped: ${e instanceof Error ? e.message : e}`); }
  }
}, 3_600_000);
