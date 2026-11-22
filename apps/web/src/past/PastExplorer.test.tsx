import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PastExplorer, useRegistry } from "./PastExplorer.js";
import { PastPage } from "./PastPage.js";
import { MemoryRouter } from "react-router-dom";
import { byYear, compareCheck, distanceToLineMetres, fetchRegistry, makeFrame, outlineToLineMetres, ringsOf, seriesToComparison, type LayerMeta, type RegLayer, type Registry } from "./pastGeo.js";
import { chartCheck } from "./pastModel.js";

const dataDir = resolve(process.cwd(), "../../data");
const read = (p: string) => JSON.parse(readFileSync(resolve(dataDir, p), "utf8"));
const roads = read("geo/osm-roads.json"), landmarks = read("geo/osm-landmarks.json"), shipped: Registry = read("geo/past/layers.json"), past = read("content/past.json");

// SYNTHETIC test layers: they exist only in these tests and are never published.
const meta = (o: Partial<LayerMeta> = {}): LayerMeta => ({ id: "x", kind: "roads", title: "T", status: "observed", source: { title: "Synthetic", url: "https://example.org/s" }, licence: "CC0-1.0", asOf: { year: 2000, precision: "year" }, accessed: "2026-11-22", method: "test", confidence: "low", limitations: "synthetic", ...o });
const layer = (id: string, o: Partial<LayerMeta> = {}): RegLayer => ({ id, kind: o.kind ?? "roads", title: o.title ?? `Layer ${id}`, status: "available", file: `geo/past/${id}.geojson`, sha256: "a".repeat(64), meta: meta({ id, ...o }), counts: { features: 1 } });
const line = (x: number) => ({ type: "FeatureCollection", features: [{ geometry: { type: "LineString", coordinates: [[72.49 + x, 22.98], [72.5 + x, 23.0]] }, properties: {} }] });
const area = { type: "FeatureCollection", features: [{ geometry: { type: "Polygon", coordinates: [[[72.5, 22.99], [72.51, 22.99], [72.51, 23], [72.5, 23], [72.5, 22.99]]] }, properties: {} }] };

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const fetcher = (routes: Record<string, unknown>) => vi.fn(async (u: string) => { const hit = Object.keys(routes).find((k) => u.endsWith(k)); return hit ? respond(routes[hit]) : respond({}, 404); }) as unknown as typeof fetch;
const base = { "/geo/osm-roads.json": roads, "/geo/osm-landmarks.json": landmarks };
const reg = (layers: RegLayer[], slots = shipped.slots, measurements = shipped.measurements): Registry => ({ version: 1, slots, layers, measurements });
afterEach(cleanup);

function Host({ f }: { f: typeof fetch }) { const r = useRegistry(f); return <PastExplorer fetcher={f} registry={r} />; }
const mount = (routes: Record<string, unknown>) => { const f = fetcher({ ...base, ...routes }); return render(<Host f={f} />); };

describe("pastGeo", () => {
  it("measures distance to a line", () => {
    expect(distanceToLineMetres([72.505, 23.001], [[72.5, 23], [72.51, 23]])).toBeGreaterThan(105);
    expect(distanceToLineMetres([72.5, 23], [[72.5, 23], [72.51, 23]])).toBeCloseTo(0, 6);
  });
  it("measures the nearest outline vertex to a road, today", () => {
    const complex = landmarks.features.find((f: { properties: { key: string } }) => f.properties.key === "complex").geometry.coordinates[0];
    const nh147 = outlineToLineMetres(complex, roads.highway.coordinates), nh8a = outlineToLineMetres(complex, roads.arterial.coordinates);
    expect(nh147).toBeGreaterThan(500); expect(nh147).toBeLessThan(3000);
    expect(nh8a).toBeGreaterThan(100); expect(nh8a).toBeLessThan(2500);
  });
  it("frames a point at the centre of the box", () => { const f = makeFrame([72.5, 23], 0.01, 640, 420); expect(f.x(72.5)).toBeCloseTo(320, 6); expect(f.y(23)).toBeCloseTo(210, 6); });
  it("extracts rings and orders layers by year", () => {
    expect(ringsOf({ type: "Polygon", coordinates: [[[0, 0]]] })).toHaveLength(1);
    expect([layer("b", { asOf: { year: 2010, precision: "year" } }), layer("a")].sort(byYear)[0]!.id).toBe("a");
  });
});

describe("compareCheck: what may be set against what", () => {
  const a = layer("a"), b = layer("b", { asOf: { year: 2020, precision: "year" } });
  it("allows two dated observations of the same kind", () => expect(compareCheck(a, b)).toMatchObject({ ok: true, kind: "change-over-time" }));
  it("labels a plan against an observation as such, never as a measured change", () => {
    const r = compareCheck(layer("p", { status: "sanctioned", kind: "tp-boundary" }), layer("o", { status: "observed", kind: "tp-boundary", asOf: { year: 2024, precision: "year" } }));
    expect(r).toMatchObject({ ok: true, kind: "planned-vs-observed" });
    if (r.ok) expect(r.label).toMatch(/not a measured change/);
  });
  it.each([
    ["different kinds", layer("w", { kind: "water", asOf: { year: 2020, precision: "year" } }), /different things/],
    ["the same year", layer("s"), /same year/],
    ["a reconstruction", layer("r", { status: "reconstruction", asOf: { year: 2020, precision: "year" } }), /illustrative/],
  ])("refuses %s", (_n, other, re) => { const r = compareCheck(a, other as RegLayer); expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toMatch(re as RegExp); });
  it("refuses a layer against itself", () => expect(compareCheck(a, a).ok).toBe(false));
});

describe("registry and measurements", () => {
  it("fetchRegistry distinguishes ok, missing and error", async () => {
    expect((await fetchRegistry(undefined, fetcher({ "/geo/past/layers.json": shipped }))).status).toBe("ok");
    expect((await fetchRegistry(undefined, fetcher({}))).status).toBe("missing");
    expect((await fetchRegistry(undefined, fetcher({ "/geo/past/layers.json": { version: 2 } }))).status).toBe("error");
    expect((await fetchRegistry(undefined, (async () => { throw new Error("x"); }) as unknown as typeof fetch)).status).toBe("error");
  });
  it("the shipped built-up series is charted: five dated points, a unit, a method and a source", () => {
    const s = shipped.measurements.find((m) => m.id === "ghsl-builtup-study-window")!;
    expect(s.points.map((p) => p.year)).toEqual([1975, 1990, 2000, 2010, 2020]);
    expect(s.points.every((p) => p.approx)).toBe(true); // a modelled estimate, so every bar is marked approximate
    expect(s.source.url).toMatch(/^https:\/\/jeodpp\.jrc\.ec\.europa\.eu/);
    expect(chartCheck(seriesToComparison(s)).ok).toBe(true);
  });
  it("a series not confirmed as same-area is cut to one point and so is not charted", () => {
    const s = { ...shipped.measurements[0]!, sameAreaAndDefinition: false };
    expect(chartCheck(seriesToComparison(s)).ok).toBe(false);
  });
});

describe("PastExplorer with no historical layers (the shipped state)", () => {
  it("shows the present-day map, the legend and every missing layer with its requirement, drawing nothing historical", async () => {
    const { container } = mount({ "/geo/past/layers.json": shipped });
    expect(await screen.findByRole("img", { name: /mapped today/ })).toBeTruthy();
    expect(container.querySelectorAll(".past-map-svg path").length).toBe(5);
    expect(screen.getByRole("list", { name: /What the map symbols mean/ })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(new RegExp(`Layers waiting for evidence \\(${shipped.slots.length}\\)`))).toBeTruthy());
    expect(screen.getAllByText(/unavailable\)/).length).toBe(shipped.slots.length);
    const item = screen.getByText(/TP 84\/B boundary/).closest("details")!;
    fireEvent.click(item.querySelector("summary")!);
    expect(within(item).getByText(/Do not trace a boundary from an aggregator screenshot/)).toBeTruthy();
    expect(within(item).getByText(/AUDA or AMC Town Planning department/)).toBeTruthy();
  });
  it("explains that a before/after comparison needs two dated layers", async () => {
    mount({ "/geo/past/layers.json": shipped });
    expect(await screen.findByText(/needs two dated layers of the same kind/)).toBeTruthy();
    expect(screen.getByText(/None is available yet/)).toBeTruthy();
  });
  it("measures today's distance from the Roza to the two main roads, as observed", async () => {
    mount({ "/geo/past/layers.json": shipped });
    const table = await screen.findByRole("table", { name: /Nearest distance from the Roza complex/ });
    expect(within(table).getAllByText("Observed today")).toHaveLength(2);
    expect(table.textContent).toMatch(/S\.G\. Highway/); expect(table.textContent).toMatch(/\d+(\.\d+)? (m|km)/);
    expect(screen.getByText(/no change over time is claimed/)).toBeTruthy();
  });
  it("reports a registry that is missing or broken without hiding the map", async () => {
    const { unmount } = mount({});
    expect(await screen.findByText(/No layer registry is published/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /mapped today/ })).toBeTruthy();
    unmount();
    render(<Host f={vi.fn(async () => respond({}, 500)) as unknown as typeof fetch} />);
    expect((await screen.findAllByRole("alert")).some((a) => /layer registry could not be loaded/.test(a.textContent ?? ""))).toBe(true);
  });
});

describe("PastExplorer with (synthetic) imported layers", () => {
  const two = [layer("roads-1990", { asOf: { year: 1990, precision: "year" }, title: "Old roads" }), layer("roads-2020", { asOf: { year: 2020, precision: "year" }, title: "New roads" })];
  const routes = { "/geo/past/layers.json": reg(two), "/geo/past/roads-1990.geojson": line(0), "/geo/past/roads-2020.geojson": line(0.004) };

  it("draws the latest layer at or before the chosen year and lets the year change it", async () => {
    const { container } = mount(routes);
    await screen.findByRole("checkbox", { name: /New roads/ });
    expect(container.querySelectorAll("figure.past-map .past-map-svg path").length).toBe(6); // 5 context + the 2020 road (the split view has its own svg)
    fireEvent.change(screen.getByLabelText(/Show layers as of/), { target: { value: "1995" } });
    expect(screen.getByLabelText(/Show layers as of/).textContent).toBeDefined();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Old roads/ })).toBeTruthy());
    expect(screen.queryByRole("checkbox", { name: /New roads/ })).toBeNull();
  });
  it("adds each layer to the proximity table with its year and status", async () => {
    mount(routes);
    const table = await screen.findByRole("table", { name: /Nearest distance/ });
    await waitFor(() => expect(within(table).getByText("Old roads")).toBeTruthy());
    expect(within(table).getByText("1990")).toBeTruthy();
  });
  it("offers a split comparison with a keyboard slider and the provenance of both sides", async () => {
    mount(routes);
    const split = await screen.findByRole("img", { name: /Split view/ });
    expect(split.getAttribute("aria-label")).toMatch(/Old roads \(1990\).*New roads \(2020\)/);
    const slider = screen.getByLabelText(/Handle position/) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "20" } });
    expect(screen.getByRole("img", { name: /20% from the left/ })).toBeTruthy();
    expect(screen.getByText(/Two dated observations of the same kind/)).toBeTruthy();
    expect(screen.getByText(/Left: Synthetic, CC0-1.0, confidence low/)).toBeTruthy();
  });
  it("refuses an incompatible pair with the reason", async () => {
    const mixed = [two[0]!, layer("water-2020", { kind: "water", asOf: { year: 2020, precision: "year" }, title: "Tank" })];
    mount({ "/geo/past/layers.json": reg(mixed), "/geo/past/roads-1990.geojson": line(0), "/geo/past/water-2020.geojson": area });
    expect(await screen.findByText(/measure different things, so they are not compared/)).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Split view/ })).toBeNull();
  });
  it("reports a layer file that fails to load and still draws the others", async () => {
    mount({ "/geo/past/layers.json": reg(two), "/geo/past/roads-1990.geojson": line(0) });
    await waitFor(() => expect(screen.getAllByRole("alert").some((a) => /roads-2020/.test(a.textContent ?? ""))).toBe(true));
  });
});

describe("PastPage integration", () => {
  const routes = { "/content/past.json": past, ...base, "/geo/past/layers.json": shipped };
  it("charts the real built-up series with unit, method, source and limits", async () => {
    render(<MemoryRouter><PastPage fetcher={fetcher(routes)} /></MemoryRouter>);
    const chart = await screen.findByRole("img", { name: /Built-up surface in the Sarkhej-Makarba study window.*GHSL 1975 1318\.5 ha \(approximate\).*GHSL 2020 3712\.9 ha/ });
    const card = chart.closest("article")!;
    expect(card.textContent).toMatch(/Unit:\s*ha/);
    expect(card.textContent).toMatch(/modelled estimate from satellite imagery, not a survey/);
    expect(within(card).getByRole("link", { name: /GHS-BUILT-S R2023A/ }).getAttribute("href")).toMatch(/^https:\/\/jeodpp/);
  });
  it("still refuses single-year census counts", async () => {
    render(<MemoryRouter><PastPage fetcher={fetcher(routes)} /></MemoryRouter>);
    await screen.findByRole("slider", { name: /Show what had happened by/ });
    expect(screen.getAllByText(/Only one dated measurement exists/).length).toBe(past.comparisons.length);
  });
});
