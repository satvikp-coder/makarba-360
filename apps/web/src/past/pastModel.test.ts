import { describe, expect, it } from "vitest";
import { chartCheck, eventsThrough, fetchPast, periodOf, schemeNeedsGeometry, usableEvents, validEvent, validVisual, yearLabel, type Comparison, type PastEvent } from "./pastModel.js";

const src = { title: "Example record", url: "https://example.org/x", tier: "primary" as const, accessed: "2026-11-22" };
const ev = (o: Partial<PastEvent> = {}): PastEvent => ({
  id: "e1", theme: "heritage", title: "T", text: "t", year: 1451, precision: "year", status: "documented", source: src, confidence: "high", uncertainty: "Dates differ by source.", ...o,
});
const cmp = (o: Partial<Comparison> = {}): Comparison => ({
  id: "c", title: "c", unit: "ha", points: [{ label: "a", year: 1900, value: 29, approx: true }, { label: "b", year: 2020, value: 14, approx: true }], source: src, method: "stated approximation", limits: "-", ...o,
});

describe("validEvent", () => {
  it("accepts a fully sourced event", () => expect(validEvent(ev())).toBe(true));
  it.each([
    ["non-https source", { source: { ...src, url: "http://example.org" } }],
    ["no access date", { source: { ...src, accessed: "" } }],
    ["no uncertainty note", { uncertainty: " " }],
    ["unknown status", { status: "built" as never }],
    ["fractional year", { year: 1451.5 }],
    ["end before start", { yearTo: 1400 }],
    ["implausible year", { year: 12 }],
  ])("rejects %s", (_n, o) => expect(validEvent(ev(o as Partial<PastEvent>))).toBe(false));
  it("rejects null", () => expect(validEvent(null)).toBe(false));
});

describe("timeline helpers", () => {
  const list = usableEvents({ events: [ev({ id: "b", year: 1990 }), ev({ id: "x", year: 1700, uncertainty: "" }), ev({ id: "a", year: 1451 })] });
  it("drops invalid events and sorts by year", () => expect(list.map((e) => e.id)).toEqual(["a", "b"]));
  it("keeps only what had started by the chosen year", () => expect(eventsThrough(list, 1500).map((e) => e.id)).toEqual(["a"]));
  it("never relabels a proposal as implemented", () => expect(eventsThrough([ev({ status: "proposed", year: 2005 })], 2020)[0]?.status).toBe("proposed"));
  it("labels circa years and ranges", () => {
    expect(yearLabel(ev({ precision: "circa" }))).toBe("c. 1451");
    expect(yearLabel(ev({ year: 1445, yearTo: 1451 }))).toBe("1445–1451");
  });
  it("finds the documented period or null", () => {
    const p = [{ id: "p", label: "P", from: 1400, to: 1599, summary: "" }];
    expect(periodOf(p, 1451)?.id).toBe("p");
    expect(periodOf(p, 1700)).toBeNull();
  });
});

describe("chartCheck", () => {
  it("charts two dated points with a method", () => expect(chartCheck(cmp()).ok).toBe(true));
  it("refuses a single measurement", () => {
    const r = chartCheck(cmp({ points: [{ label: "2001", year: 2001, value: 18090, approx: false }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Only one dated measurement/);
  });
  it("refuses two points in the same year", () => expect(chartCheck(cmp({ points: [{ label: "a", year: 2001, value: 1, approx: false }, { label: "b", year: 2001, value: 2, approx: false }] })).ok).toBe(false));
  it("refuses a missing method, unit or source", () => {
    expect(chartCheck(cmp({ method: "" })).ok).toBe(false);
    expect(chartCheck(cmp({ unit: "" })).ok).toBe(false);
    expect(chartCheck(cmp({ source: { ...src, url: "" } })).ok).toBe(false);
  });
  it("ignores non-finite values", () => expect(chartCheck(cmp({ points: [{ label: "a", year: 1900, value: NaN, approx: false }, { label: "b", year: 2020, value: 14, approx: false }] })).ok).toBe(false));
});

describe("geometry and imagery", () => {
  it("flags schemes without a reviewed boundary", () => {
    expect(schemeNeedsGeometry({ id: "s", name: "n", status: "x", source: src, geometry: "unavailable", note: "" })).toBe(true);
    expect(schemeNeedsGeometry({ id: "s", name: "n", status: "x", source: src, geometry: "available", note: "" })).toBe(false);
  });
  it("needs alt text, a licence and a source page for an image", () => {
    const v = { id: "v", src: "images/a.jpg", alt: "alt", caption: "c", year: 1855, precision: "exact" as const, kind: "photograph" as const, author: "a", licence: "Public domain", commonsUrl: "https://commons.wikimedia.org/x" };
    expect(validVisual(v)).toBe(true);
    expect(validVisual({ ...v, alt: "" })).toBe(false);
    expect(validVisual({ ...v, licence: "" })).toBe(false);
  });
});

describe("fetchPast", () => {
  const f = (o: { status?: number; ok?: boolean; json?: unknown }) => (async () => ({ status: o.status ?? 200, ok: o.ok ?? true, json: async () => o.json })) as unknown as typeof fetch;
  it("returns the document", async () => expect((await fetchPast(undefined, f({ json: { events: [], periods: [] } }))).status).toBe("ok"));
  it("reports missing and error states", async () => {
    expect((await fetchPast(undefined, f({ status: 404, ok: false }))).status).toBe("missing");
    expect((await fetchPast(undefined, f({ status: 500, ok: false }))).status).toBe("error");
    expect((await fetchPast(undefined, f({ json: { nope: 1 } }))).status).toBe("error");
    expect((await fetchPast(undefined, (async () => { throw new Error("net"); }) as unknown as typeof fetch)).status).toBe("error");
  });
});
