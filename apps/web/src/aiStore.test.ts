import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureAi, ensureBriefing, getAi, highlightsPrompt, parseHighlights, resetBundled } from "./aiStore.js";
import { signal, type ForecastDoc, type Series } from "./outlook.js";

const ids = new Set(["NY.GDP.PCAP.CD", "WEATHER_AHD_HOTDAYS"]);
const ok = (extra: Record<string, unknown> = {}) => ({ title: "Hotter streets", body: "Summers could feel harsher by 2034, up 30% in hot days", icon: "thermo", tone: "negative", anchor: "heat", indicators: ["WEATHER_AHD_HOTDAYS", "MADE_UP"], ...extra });

describe("generative highlights are validated before the UI trusts them", () => {
  it("keeps valid items, strips numbers from model text, drops unknown indicators, and falls back on icons", () => {
    const r = parseHighlights(JSON.stringify({ headline: "A hotter, busier ward", highlights: [ok(), ok({ title: "Busier highway", anchor: "traffic", icon: "rocket", tone: "weird" })] }), ids)!;
    expect(r.headline).toBe("A hotter, busier ward");
    expect(r.highlights).toHaveLength(2);
    expect(r.highlights[0]!.body).not.toMatch(/\d/);
    expect(r.highlights[0]!.body).toBe("Summers could feel harsher, up in hot days");   // "by 2034" removed whole, no dangling "by"
    expect(r.highlights[0]!.indicators).toEqual(["WEATHER_AHD_HOTDAYS"]);
    expect(r.highlights[1]).toMatchObject({ icon: "spark", tone: "mixed", anchor: "traffic" });
  });
  it("drops items pointing at places that are not on the map, duplicates, and caps the list at six", () => {
    const many = Array.from({ length: 9 }, (_, i) => ok({ title: `Item ${i}`, anchor: i === 0 ? "moon-base" : "corridor" }));
    const r = parseHighlights("Sure! Here you go: " + JSON.stringify({ highlights: [...many, ok({ title: "Item 1", anchor: "corridor" })] }) + " Hope it helps", ids)!;
    expect(r.highlights).toHaveLength(6);
    expect(r.highlights.some((h) => h.title === "Item 0")).toBe(false);
  });
  it("rejects malformed output and too few items", () => {
    expect(parseHighlights("not json", ids)).toBeNull();
    expect(parseHighlights(JSON.stringify({ highlights: [ok()] }), ids)).toBeNull();
  });
  it("the prompt lists every anchor and the series ids with their numbers", () => {
    const s: Series = { id: "NY.GDP.PCAP.CD", label: "GDP per capita", theme: "economic", unit: "US$", good: "up", history: [{ year: 2024, value: 100 }], forecast: [{ year: 2034, value: 150, lo: 140, hi: 160 }] };
    const p = highlightsPrompt([signal(s, 2034)!], 2034);
    expect(p).toMatch(/corridor\|redevelop\|.*heat\|roza/s);
    expect(p).toMatch(/NY\.GDP\.PCAP\.CD\|GDP per capita\|100→150 US\$\|improving/);
    // people-centred, in the wording Apple's on-device guardrail accepts (a "most important impacts / who faces costs" ranking is refused)
    expect(p).toMatch(/balanced highlights for a class discussion/);
    expect(p).toMatch(/who could gain or lose out/);
    expect(p).not.toMatch(/MOST IMPORTANT|face costs/);
    expect(p.length / 4).toBeLessThan(900);   // compact: local models are slow with long prompts
  });
});

describe("compact prompt and robust parsing", () => {
  it("keeps the people-centred indicators, then the strongest changes, 24 in all, never markets", async () => {
    const { compactSignals } = await import("./aiStore.js");
    const mk = (id: string, i: number, theme = "economic") => signal({ id, label: id, theme, unit: "US$", good: "up", history: [{ year: 2024, value: 100 }], forecast: [{ year: 2034, value: 100 + i, lo: 99, hi: 101 + i }] }, 2034)!;
    const all = [...Array.from({ length: 40 }, (_, i) => mk(`S${i}`, i)), mk("WEATHER_AHD_HOTDAYS", 0, "city"), mk("^NSEI", 99, "markets")];
    const c = compactSignals(all);
    expect(c).toHaveLength(24);
    expect(c[0]!.s.id).toBe("WEATHER_AHD_HOTDAYS");          // must-have, even with no change
    expect(c[1]!.s.id).toBe("S39");                          // then the biggest change
    expect(c.some((x) => x.s.id === "^NSEI")).toBe(false);
  });
  it("repairs a dropped key quote, a typical small-model slip", () => {
    const raw = '{"headline":"H","highlights":[{"title":"A","body":"B could happen","who":["vendors"],"right":"R",icon":"car",tone":"negative",anchor":"canal","indicators":[]},{"title":"C","body":"D may happen","who":[],"right":"",icon":"bus","tone":"mixed","anchor":"traffic","indicators":[]}]}';
    const r = parseHighlights(raw, ids)!;
    expect(r.highlights.map((h) => [h.icon, h.tone, h.anchor])).toEqual([["car", "negative", "canal"], ["bus", "mixed", "traffic"]]);
    expect(r.highlights[0]!.who).toEqual(["vendors"]);
  });
});

describe("provider calls and time limits", () => {
  const doc = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/forecasts.json"), "utf8")) as ForecastDoc;
  const answer = JSON.stringify({ headline: "Hotter, busier streets", highlights: [0, 1, 2, 3].map((i) => ({ title: `Change ${i}`, body: "Streets could feel hotter", who: ["street vendors", "auto drivers"], right: "Who keeps shade?", icon: "thermo", tone: "negative", anchor: "heat", indicators: ["WEATHER_AHD_HOTDAYS"] })) });
  // Apple's guided generation answers in one piece; generateMs is how long it "thinks"
  const stub = (generateMs: number) => vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    if (url === "/applefm/health") return Promise.resolve(new Response(JSON.stringify({ available: true })));
    if (url === "/ollama/api/tags") return Promise.resolve(new Response(JSON.stringify({ models: [] })));
    if (url === "/applefm/generate") return new Promise((res, rej) => {   // like fetch: an abort rejects the request
      const t = setTimeout(() => res(new Response(JSON.stringify({ response: answer }))), generateMs);
      init?.signal?.addEventListener("abort", () => { clearTimeout(t); rej(init.signal!.reason); });
    });
    return Promise.resolve(new Response("{}", { status: 404 }));
  }));
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); globalThis.localStorage?.clear?.(); });

  it("a non-streamed Apple answer after 40 s is used, not cut off by the 30 s stall guard (regression)", async () => {
    vi.useFakeTimers();
    stub(40_000);
    const run = ensureAi(doc, 2041, { force: true });
    await vi.advanceTimersByTimeAsync(41_000);
    await run;
    const e = getAi(doc, 2041);
    expect(e.status).toBe("done");
    expect(e.provider).toBe("applefm");
    expect(e.highlights).toHaveLength(4);
  });
  it("an answer slower than the overall limit still ends in an error instead of spinning forever", async () => {
    vi.useFakeTimers();
    stub(200_000);
    const run = ensureAi(doc, 2042, { force: true });
    await vi.advanceTimersByTimeAsync(95_000);
    await run;
    const e = getAi(doc, 2042);
    expect(e.status).toBe("error");
    expect(e.error).toMatch(/took longer than 90 s/);
  });
});

describe("pre-generated insights (data/ai/insights.json)", () => {
  const doc = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/forecasts.json"), "utf8")) as ForecastDoc;
  const hl = (i: number) => ({ title: `Change ${i}`, body: "Streets could feel hotter", who: ["street vendors"], right: "Who keeps shade?", icon: "thermo", tone: "negative", anchor: "heat", indicators: ["WEATHER_AHD_HOTDAYS"] });
  const file = (forecast: string) => ({ forecast, series: doc.series.length, provider: "applefm", model: "apple-foundation-model", at: "2026-11-13T00:00:00Z", years: { 2043: { headline: "Hotter streets", highlights: [0, 1, 2, 3].map(hl), briefing: "**Big picture** ..." } } });
  const calls: string[] = [];
  const stub = (body: unknown) => vi.stubGlobal("fetch", vi.fn((url: string) => {
    calls.push(url);
    if (url === "/ai/insights.json") return Promise.resolve(new Response(JSON.stringify(body)));
    return Promise.resolve(new Response("{}", { status: 404 }));   // no live model anywhere
  }));
  afterEach(() => { vi.unstubAllGlobals(); resetBundled(); calls.length = 0; });

  it("a matching file answers at once: highlights and briefing, labelled pre-generated, with no model call", async () => {
    stub(file(doc.generated));
    await ensureAi(doc, 2043);
    await ensureBriefing(doc, 2043);
    const e = getAi(doc, 2043);
    expect(e.status).toBe("done");
    expect(e.highlights).toHaveLength(4);
    expect(e.briefing).toMatch(/Big picture/);
    expect(e.model).toMatch(/pre-generated/);
    expect(calls.filter((u) => /generate|chat/.test(u))).toEqual([]);
  });
  it("the optional markets series (added locally) do not make a matching file look stale", async () => {
    stub(file(doc.generated));
    const withMarkets = { ...doc, series: [...doc.series, { ...doc.series[0]!, id: "^NSEI", theme: "markets" }] } as ForecastDoc;
    await ensureAi(withMarkets, 2043);
    expect(getAi(withMarkets, 2043).model).toMatch(/pre-generated/);
  });
  it("a file made from a different forecast is ignored (the numbers would not match)", async () => {
    stub(file("2020-01-01T00:00:00Z"));
    await ensureAi(doc, 2044);
    expect(getAi(doc, 2044).status).toBe("offline");
  });
});

describe("highlight text cleanup", () => {
  it("drops the repeated right-to-the-city sentence from the body, keeps whole sentences, and turns the label into a question", () => {
    const raw = JSON.stringify({ headline: "H", highlights: [0, 1].map((i) => ({ title: `T${i}`, anchor: "heat", icon: "thermo", tone: "mixed", who: ["vendors"], indicators: [],
      body: "Street vendors may face tighter rules. Some may shift to formal work. The right-to-the-city question: who controls the streets and their use",
      right: "The right-to-the-city question: who controls the streets" })) });
    const h = parseHighlights(raw, new Set())!.highlights[0]!;
    expect(h.body).toBe("Street vendors may face tighter rules. Some may shift to formal work.");
    expect(h.right).toBe("Who controls the streets?");
  });
  it("a long body is cut at a sentence end, never mid-word", () => {
    const long = `${"Rents could rise near the highway. ".repeat(8)}Tail words here`;
    const raw = JSON.stringify({ headline: "H", highlights: [0, 1].map((i) => ({ title: `T${i}`, anchor: "heat", body: long, right: "" })) });
    const b = parseHighlights(raw, new Set())!.highlights[0]!.body;
    expect(b.length).toBeLessThanOrEqual(200);
    expect(b.endsWith("highway.")).toBe(true);
  });
});
