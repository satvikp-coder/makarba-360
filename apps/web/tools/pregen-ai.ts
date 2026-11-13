/**
 * Pre-generates the AI highlights and briefing for every forecast year with Apple's on-device model (tools/applefm bridge), so the
 * site can show them instantly. Output: data/ai/insights.json, tied to the forecast file it was made from (a newer forecast file
 * makes the site ignore it and generate live again). Run:  pnpm --filter web exec vitest run -c tools/vitest.pregen.config.ts
 * Requires macOS 26+ with Apple Intelligence and the bridge running (./run.sh starts it). Years that fail are left out.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { briefingPrompt, compactSignals, highlightsPrompt, parseHighlights } from "../src/aiStore.js";
import { signals, type ForecastDoc } from "../src/outlook.js";

const ROOT = resolve(process.cwd(), "../..");
const OUT = resolve(ROOT, "data/ai/insights.json");
const BRIDGE = process.env.APPLEFM_HOST ?? "http://127.0.0.1:11535";
const doc = JSON.parse(readFileSync(resolve(ROOT, "data/forecasts.json"), "utf8")) as ForecastDoc;

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

it("pre-generates AI insights for every forecast year", async () => {
  const first = new Date().getFullYear() + 1, last = doc.maxYear ?? 2050;
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const series = doc.series.filter((x) => x.theme !== "markets").length;
  const same = prev && prev.forecast === doc.generated && prev.series === series;
  const out = { _about: "AI-generated (Apple Foundation Model, on device) from the TimesFM forecasts; may be wrong. Regenerate with apps/web/tools/pregen-ai.ts.", forecast: doc.generated, series, provider: "applefm", model: "apple-foundation-model", at: new Date().toISOString(), years: (same ? prev.years : {}) as Record<string, unknown> };
  for (let year = first; year <= last; year++) {
    if (out.years[year]) continue;
    const t = Date.now();
    try {
      const sig = compactSignals(signals(doc, year));
      const parsed = parseHighlights(await ask(highlightsPrompt(sig, year), "highlights"), new Set(sig.map((x) => x.s.id)));
      if (!parsed) throw new Error("unreadable highlights");
      const briefing = await ask(briefingPrompt(sig, year));
      out.years[year] = { ...parsed, briefing };
      writeFileSync(OUT, JSON.stringify(out, null, 1));   // save as we go: an interrupted run keeps what it made
      console.log(`${year} ok in ${((Date.now() - t) / 1000).toFixed(0)} s`);
    } catch (e) { console.log(`${year} skipped: ${e instanceof Error ? e.message : e}`); }
  }
}, 3_600_000);
