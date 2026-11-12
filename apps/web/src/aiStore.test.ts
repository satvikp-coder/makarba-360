import { describe, expect, it } from "vitest";
import { highlightsPrompt, parseHighlights } from "./aiStore.js";
import { signal, type Series } from "./outlook.js";

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
    expect(p).toMatch(/corridor .*heat .*roza/s);
    expect(p).toMatch(/NY\.GDP\.PCAP\.CD \| GDP per capita \(economic\): 100 in 2024 -> 150 in 2034/);
  });
});

describe("Apple Intelligence", () => {
  it("gets the strongest signals only (small context window); other providers get everything", async () => {
    const { forProvider } = await import("./aiStore.js");
    const mk = (i: number) => signal({ id: `S${i}`, label: `S${i}`, theme: "economic", unit: "US$", good: "up", history: [{ year: 2024, value: 100 }], forecast: [{ year: 2034, value: 100 + i, lo: 99, hi: 101 + i }] }, 2034)!;
    const all = Array.from({ length: 40 }, (_, i) => mk(i));
    const a = forProvider(all, "applefm");
    expect(a).toHaveLength(28);
    expect(a[0]!.s.id).toBe("S39");                 // biggest change first
    expect(a.some((x) => x.s.id === "S0")).toBe(false);
    expect(forProvider(all, "ollama")).toHaveLength(40);
  });
});
