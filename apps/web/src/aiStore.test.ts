import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastFingerprint, getAi, loadInsights, parseHighlights, resetInsights } from "./aiStore.js";
import type { ForecastDoc } from "./outlook.js";

const ids = new Set(["NY.GDP.PCAP.CD", "WEATHER_AHD_HOTDAYS"]);
const ok = (extra: Record<string, unknown> = {}) => ({ title: "Hotter streets", body: "Summers could feel harsher by 2034, up 30% in hot days", icon: "thermo", tone: "negative", anchor: "heat", indicators: ["WEATHER_AHD_HOTDAYS", "MADE_UP"], ...extra });

describe("generative highlights are validated before the UI trusts them", () => {
  it("keeps valid items, strips numbers from model text, drops unknown indicators, and falls back on icons", () => {
    const r = parseHighlights(JSON.stringify({ headline: "A hotter, busier ward", highlights: [ok(), ok({ title: "Busier highway", anchor: "traffic", icon: "rocket", tone: "weird" })] }), ids)!;
    expect(r.headline).toBe("A hotter, busier ward");
    expect(r.highlights).toHaveLength(2);
    expect(r.highlights[0]!.body).not.toMatch(/\d/);
    expect(r.highlights[0]!.body).toBe("Summers could feel harsher, up in hot days.");   // "by 2034" removed whole, no dangling "by"
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
});

describe("stored AI insights (data/ai/insights.json)", () => {
  const doc = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/forecasts.json"), "utf8")) as ForecastDoc;
  const hl = (i: number) => ({ title: `Change ${i}`, body: "Streets could feel hotter", who: ["street vendors"], right: "Who keeps shade?", icon: "thermo", tone: "negative", anchor: "heat", indicators: ["WEATHER_AHD_HOTDAYS"] });
  const file = (fingerprint: string) => ({ fingerprint, years: { 2043: { headline: "Hotter streets", highlights: [0, 1, 2, 3].map(hl), briefing: "**Big picture** ..." } } });
  const calls: string[] = [];
  const stub = (res: () => Response) => vi.stubGlobal("fetch", vi.fn((url: string) => { calls.push(url); return Promise.resolve(res()); }));
  afterEach(() => { vi.unstubAllGlobals(); resetInsights(); calls.length = 0; });

  it("a matching file answers with highlights and briefing, and the file is the only request (no model is ever called)", async () => {
    stub(() => new Response(JSON.stringify(file(forecastFingerprint(doc)))));
    expect(getAi(doc, 2043).status).toBe("loading");
    await loadInsights(doc);
    await loadInsights(doc);
    const e = getAi(doc, 2043);
    expect(e.status).toBe("done");
    expect(e.highlights).toHaveLength(4);
    expect(e.briefing).toMatch(/Big picture/);
    expect(getAi(doc, 2044).status).toBe("none");
    expect(calls).toEqual(["/ai/insights.json"]);
  });
  it("the optional markets series (added locally) do not make a matching file look stale", async () => {
    stub(() => new Response(JSON.stringify(file(forecastFingerprint(doc)))));
    const withMarkets = { ...doc, series: [...doc.series, { ...doc.series[0]!, id: "^NSEI", theme: "markets" }] } as ForecastDoc;
    await loadInsights(withMarkets);
    expect(getAi(withMarkets, 2043).status).toBe("done");
  });
  it("a file made from different forecast values is ignored (the numbers would not match)", async () => {
    stub(() => new Response(JSON.stringify(file(forecastFingerprint(doc)))));
    const changed = structuredClone(doc);
    changed.series[0]!.forecast[0]!.value += 1;
    expect(forecastFingerprint(changed)).not.toBe(forecastFingerprint(doc));
    await loadInsights(changed);
    expect(getAi(changed, 2043).status).toBe("none");
  });
  it("a missing or broken file shows nothing instead of failing", async () => {
    stub(() => new Response("<!doctype html>", { status: 404 }));
    await loadInsights(doc);
    expect(getAi(doc, 2043).status).toBe("none");
  });
  it("ignores malformed model items", () => {
    expect(parseHighlights('{"highlights":[null, 3]}', new Set())).toBeNull();
  });
  it("ships readable insights for every forecast year, made from the current forecast contents", () => {
    const shipped = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/ai/insights.json"), "utf8"));
    expect(shipped.fingerprint).toBe(forecastFingerprint(doc));
    const ids = new Set(doc.series.map((s) => s.id));
    for (let y = 2027; y <= doc.maxYear; y++) {
      const v = shipped.years[y];
      expect(v, `year ${y}`).toBeTruthy();
      expect(parseHighlights(JSON.stringify(v), ids)?.highlights.length, `year ${y}`).toBeGreaterThanOrEqual(2);
      expect(v.briefing, `year ${y}`).toMatch(/\w/);
    }
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
  it("ends every body as a sentence and strips a comma-led right-to-the-city label", () => {
    const raw = JSON.stringify({ headline: "H", highlights: [["Jobs could move to tech,", "The right-to-the-city question, who can afford to stay"], ["New work may emerge in tech", ""]].map(([body, right], i) => ({ title: `T${i}`, anchor: "heat", body, right })) });
    const [a, b] = parseHighlights(raw, new Set())!.highlights;
    expect(a!.body).toBe("Jobs could move to tech.");
    expect(a!.right).toBe("Who can afford to stay?");
    expect(b!.body).toBe("New work may emerge in tech.");
  });
  it("a long body is cut at a sentence end, never mid-word", () => {
    const long = `${"Rents could rise near the highway. ".repeat(8)}Tail words here`;
    const raw = JSON.stringify({ headline: "H", highlights: [0, 1].map((i) => ({ title: `T${i}`, anchor: "heat", body: long, right: "" })) });
    const b = parseHighlights(raw, new Set())!.highlights[0]!.body;
    expect(b.length).toBeLessThanOrEqual(200);
    expect(b.endsWith("highway.")).toBe(true);
    expect(parseHighlights(raw, new Set())!.highlights[0]!.fullBody).toBe(`${long}.`);
  });
});
