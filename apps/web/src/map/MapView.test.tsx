import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
// eslint-disable-next-line prefer-const
let self: { maps: unknown[]; throwOnCreate: boolean };
class FakeMap {
  opts: Record<string, unknown>;
  handlers: Record<string, ((e?: unknown) => void)[]> = {};
  layers: { id: string }[] = [];
  removed = false;
  canvas = document.createElement("canvas");
  data: unknown = null;
  sources: Record<string, Record<string, unknown>> = {};
  fitted: unknown[] = [];
  eased: unknown[] = [];
  flown: unknown[] = [];
  jumped: unknown[] = [];
  paint: [string, string, unknown][] = [];
  lights: unknown[] = [];
  constructor(o: Record<string, unknown>) {
    if (self.throwOnCreate) throw new Error("Failed to initialize WebGL");
    this.opts = o;
    self.maps.push(this);
  }
  addControl() {}
  getCanvas() { return this.canvas; }
  on(ev: string, a: unknown, b?: unknown) {
    const [n, f] = typeof a === "string" ? [`${ev}:${a}`, b] : [ev, a];
    (this.handlers[n as string] ??= []).push(f as () => void);
  }
  once(ev: string, f: () => void) { this.on(ev, f); }
  fire(ev: string, e?: unknown) { (this.handlers[ev] ?? []).forEach((f) => f(e)); }
  addSource(id: string, o: Record<string, unknown>) { this.sources[id] = o; }
  fitBounds(...a: unknown[]) { this.fitted.push(a); }
  easeTo(o: unknown) { this.eased.push(o); }
  flyTo(o: unknown) { this.flown.push(o); }
  jumpTo(o: unknown) { this.jumped.push(o); }
  getZoom() { return 15; }
  getPitch() { return 58; }
  getBearing() { return -24; }
  addLayer(l: { id: string }) { this.layers.push(l); }
  getLayer(id: string) { return this.layers.find((l) => l.id === id) ?? (["canal-flow", "traffic-a", "traffic-b", "background", "buildings"].includes(id) ? { id } : undefined); }
  other: Record<string, unknown> = {};
  getSource(id: string) { return { setData: (d: unknown) => { if (id === "places") this.data = d; else this.other[id] = d; }, getClusterExpansionZoom: () => Promise.resolve(13) }; }
  setPaintProperty(l: string, k: string, v: unknown) { this.paint.push([l, k, v]); }
  setLight(l: unknown) { this.lights.push(l); }
  setSky() {}
  remove() { this.removed = true; }
}
class FakeMarker {
  el: HTMLElement; at: unknown = null; removed = false;
  constructor(o: { element: HTMLElement }) { this.el = o.element; (self as unknown as { markers: FakeMarker[] }).markers.push(this); }
  setLngLat(p: unknown) { this.at = p; return this; }
  addTo() { return this; }
  remove() { this.removed = true; }
}
self = { maps: [] as FakeMap[], markers: [] as FakeMarker[], throwOnCreate: false, attrib: [] as unknown[], FakeMap, FakeMarker } as typeof self & { attrib: unknown[]; FakeMap: typeof FakeMap };
return self as typeof self & { maps: FakeMap[]; markers: FakeMarker[]; attrib: unknown[]; FakeMap: typeof FakeMap; FakeMarker: typeof FakeMarker };
});
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(), Map: h.FakeMap, Marker: h.FakeMarker, NavigationControl: class {}, ScaleControl: class {}, AttributionControl: class { constructor(o: unknown) { h.attrib.push(o); } },
}));
import { MapView, anchorOf, boundsOf, buildStyle, HOME_VIEW } from "./MapView.js";
import { generateBuildings, inside, LAKE, MAKARBA_BOUNDS, THEMES } from "./basemap.js";
import { TOUR } from "./tour.js";
import type { PublicFeature } from "../api.js";

const feats: PublicFeature[] = [
  { type: "Feature", id: "00000000-0000-4000-8000-000000000001", geometry: { type: "Point", coordinates: [72.5062, 22.9936] }, properties: { slug: "s", name: { en: "Demo cart corner" }, category: "market" } },
  { type: "Feature", id: "00000000-0000-4000-8000-000000000002", geometry: { type: "MultiPolygon", coordinates: [[[[72.503, 22.991], [72.506, 22.991], [72.506, 22.993], [72.503, 22.991]]]] }, properties: { slug: "a", name: "Demo area", category: "heritage" } },
];
const matchMedia = (reduce: boolean) => vi.fn().mockImplementation((q: string) => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
beforeEach(() => { h.attrib.length = 0; h.maps.length = 0; h.markers.length = 0; h.throwOnCreate = false; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(window, "matchMedia"); });

describe("MapView (offline 3D)", () => {
  it("builds a fully offline style: only local GeoJSON sources, no tile, glyph, sprite or font URL", () => {
    for (const time of ["day", "dusk", "night"] as const) {
      const style = buildStyle(time);
      const json = JSON.stringify(style);
      expect(json).not.toMatch(/https?:\/\//);
      expect(style.glyphs).toBeUndefined();
      expect(style.sprite).toBeUndefined();
      for (const s of Object.values(style.sources)) expect(s.type).toBe("geojson");
      expect(style.layers.some((l) => l.type === "symbol")).toBe(false);   // labels are HTML, so no glyphs are ever needed
      expect(style.layers.find((l) => l.id === "buildings")?.type).toBe("fill-extrusion");
    }
  });
  it("creates one map with source and basemap attribution, then loads the place layers and data", async () => {
    const onStatus = vi.fn();
    render(<MapView features={feats} sourceAttribution="Places: prototype example data (fictional)" onStatus={onStatus} />);
    const m = h.maps[0]!;
    expect(document.querySelector(".map-attrib")!.textContent).toMatch(/^Places: prototype example data \(fictional\) · Basemap: Makarba 360 sketch map \(approximate\)$/);
    expect(document.querySelector(".maplibregl-ctrl")).toBeNull();   // our own controls, not MapLibre's
    expect(JSON.stringify(m.opts.style)).not.toMatch(/openstreetmap|https?:/);
    m.fire("load");
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    expect(m.layers.map((l) => l.id)).toEqual(["places-fill", "places-line", "places-cluster", "places-point"]);
    expect(m.layers[0]).toMatchObject({ type: "fill-extrusion" });
    expect(m.sources["places"]!.cluster).toBe(true);
    await waitFor(() => expect((m.data as { features: unknown[] }).features).toHaveLength(2));
    expect(screen.getByRole("region", { name: /Interactive 3D map/ })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Map legend" }).textContent).toContain("Heritage");
    // decorative HTML labels: basemap names plus one per place, all hidden from assistive technology and never focusable
    await waitFor(() => expect(h.markers.some((x) => x.el.textContent === "Demo cart corner")).toBe(true));
    for (const x of h.markers) { expect(x.el.getAttribute("aria-hidden")).toBe("true"); expect(x.el.hasAttribute("tabindex")).toBe(false); }
  });
  it("selecting a point or a name label on the map reports the public feature id", async () => {
    const onSelect = vi.fn();
    render(<MapView features={feats} sourceAttribution="x" onSelect={onSelect} />);
    const m = h.maps[0]!;
    m.fire("load");
    m.fire("click:places-point", { features: [{ properties: { locationId: feats[0]!.id } }] });
    expect(onSelect).toHaveBeenCalledWith(feats[0]!.id);
    await waitFor(() => expect(h.markers.some((x) => x.el.textContent === "Demo area")).toBe(true));
    fireEvent.click(h.markers.find((x) => x.el.textContent === "Demo area")!.el);
    expect(onSelect).toHaveBeenLastCalledWith(feats[1]!.id);
  });
  it("reduced motion: no intro flight (jumps straight to the 3D view) and ambient motion starts paused", async () => {
    vi.stubGlobal("matchMedia", matchMedia(true));
    const { container } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    expect(m.opts).toMatchObject({ zoom: HOME_VIEW.zoom, pitch: HOME_VIEW.pitch });
    act(() => m.fire("load"));
    await waitFor(() => expect(m.jumped.length).toBe(1));
    expect(m.flown).toEqual([]);
    const wrap = container.querySelector(".map-wrap")!;
    expect(wrap.getAttribute("data-motion")).toBe("reduced");
    expect(wrap.getAttribute("data-paused")).toBe("true");
    expect(wrap.getAttribute("data-intro")).toBe("done");
    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
  });
  it("full motion: animated fly-in, and the visitor can pause the ambient motion", async () => {
    vi.stubGlobal("matchMedia", matchMedia(false));
    const { container } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    expect(m.opts).toMatchObject({ pitch: 0 });
    act(() => m.fire("load"));
    await waitFor(() => expect(m.flown.length).toBe(1));
    expect(m.flown[0]).toMatchObject({ center: HOME_VIEW.center, pitch: HOME_VIEW.pitch, duration: 4200 });
    const wrap = container.querySelector(".map-wrap")!;
    expect(wrap.getAttribute("data-intro")).toBe("flying");
    act(() => m.fire("moveend"));
    expect(wrap.getAttribute("data-intro")).toBe("done");
    fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
    expect(wrap.getAttribute("data-paused")).toBe("true");
    expect(screen.getByRole("button", { name: "Play motion" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("selection flies to the place, highlights it and adds a pulsing ring", async () => {
    vi.stubGlobal("matchMedia", matchMedia(false));
    const { rerender } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    act(() => m.fire("load"));
    rerender(<MapView features={feats} sourceAttribution="x" selectedId={feats[0]!.id} />);
    await waitFor(() => expect(m.flown.some((f) => JSON.stringify((f as { center: unknown }).center) === JSON.stringify([72.5062, 22.9936]))).toBe(true));
    expect(h.markers.some((x) => x.el.classList.contains("map-pulse") && !x.removed)).toBe(true);
    expect(m.paint.some(([l, k]) => l === "places-fill" && k === "fill-extrusion-height")).toBe(true);
    rerender(<MapView features={feats} sourceAttribution="x" selectedId={null} />);
    await waitFor(() => expect(h.markers.filter((x) => x.el.classList.contains("map-pulse")).every((x) => x.removed)).toBe(true));
  });
  it("time-of-day lighting and the 3D toggle are buttons with pressed state", async () => {
    render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    act(() => m.fire("load"));
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    await waitFor(() => expect(m.lights).toContainEqual(THEMES.night.light));
    expect(screen.getByRole("button", { name: "Night" }).getAttribute("aria-pressed")).toBe("true");
    expect(m.paint).toContainEqual(["background", "background-color", THEMES.night.bg]);
    fireEvent.click(screen.getByRole("button", { name: "3D buildings" }));
    await waitFor(() => expect(m.eased).toContainEqual(expect.objectContaining({ pitch: 0 })));
    expect(screen.getByRole("button", { name: "3D buildings" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("story tour: visits every landmark stop, then every place; sources sit in a tooltip; places offer details", async () => {
    const onSelect = vi.fn();
    render(<MapView features={feats} sourceAttribution="x" onSelect={onSelect} />);
    const m = h.maps[0]!;
    act(() => m.fire("load"));
    fireEvent.click(screen.getByRole("button", { name: "Start story tour" }));
    const tour = await screen.findByRole("region", { name: "Story tour" });
    const total = TOUR.length + feats.length;
    expect(tour.textContent).toContain(`Stop 1 of ${total}`);
    expect(tour.textContent).not.toMatch(/Sourced fact|Example narrative/);
    expect(screen.getByLabelText(`Source: ${TOUR[0]!.source}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous stop" })).toHaveProperty("disabled", true);
    for (let i = 1; i < total; i++) fireEvent.click(screen.getByRole("button", { name: "Next stop" }));
    // jsdom has no matchMedia, so the calm path is used: every stop is a jump, never a timed flight
    await waitFor(() => expect(m.jumped.length).toBeGreaterThanOrEqual(total));
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(onSelect).toHaveBeenCalledWith(String(feats[feats.length - 1]!.id));
    expect(TOUR.every((s) => !/^Example narrative/.test(s.caption))).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "End story tour" })[0]!);
    expect(screen.queryByRole("region", { name: "Story tour" })).toBeNull();
  });
  it("WebGL unsupported: shows the list-alternative message and a 2D drawing, and does not throw", () => {
    h.throwOnCreate = true;
    const onStatus = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(<MapView features={feats} sourceAttribution="x" onStatus={onStatus} onSelect={onSelect} />);
    expect(onStatus).toHaveBeenCalledWith("unavailable");
    expect(screen.getByRole("status").textContent).toMatch(/list of places below/);
    expect(screen.queryByRole("region", { name: /Interactive 3D map/ })).toBeNull();
    expect(screen.getByRole("img", { name: /Flat 2D sketch/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Night" })).toBeNull();
    fireEvent.click(container.querySelector("circle")!);
    expect(onSelect).toHaveBeenCalledWith(feats[0]!.id);
  });
  it("renderer/context loss switches to the accessible alternative", async () => {
    render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    m.fire("load");
    m.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect((await screen.findByRole("status")).textContent).toMatch(/map is unavailable/);
    expect(screen.getByRole("img", { name: /Flat 2D sketch/ })).toBeTruthy();
  });
  it("zooms into a cluster when it is clicked", async () => {
    render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    m.fire("load");
    m.fire("click:places-cluster", { features: [{ properties: { cluster_id: 7 } }], lngLat: { lng: 1, lat: 2 } });
    await waitFor(() => expect(m.eased).toContainEqual(expect.objectContaining({ center: [1, 2], zoom: 13 })));
  });
  it("refits the camera when the published set changes (filters/search)", async () => {
    const { rerender } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    act(() => m.fire("load"));
    rerender(<MapView features={[feats[1]!]} sourceAttribution="x" />);
    await waitFor(() => expect(m.fitted.length).toBe(1));
  });
  it("computes bounds and anchors over points, lines and polygons and returns null for no data", () => {
    expect(boundsOf([])).toBeNull();
    const f = (g: unknown) => ({ type: "Feature", id: "i", geometry: g, properties: { slug: "s", name: "n", category: "c" } }) as PublicFeature;
    expect(boundsOf([f({ type: "Point", coordinates: [1, 2] }), f({ type: "LineString", coordinates: [[0, 5], [3, -1]] }), f({ type: "Polygon", coordinates: [[[-2, 0], [4, 0], [4, 9], [-2, 0]]] })])).toEqual([[-2, -1], [4, 9]]);
    expect(anchorOf(f({ type: "MultiLineString", coordinates: [[[0, 0], [1, 1], [2, 2]]] }))).toEqual([1, 1]);
    expect(anchorOf(f({ type: "MultiPolygon", coordinates: [[[[0, 0], [2, 0], [2, 4], [0, 0]]]] }))).toEqual([1, 2]);
  });
  it("removes the map on unmount", () => {
    const { unmount } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    unmount();
    expect(m.removed).toBe(true);
  });
});

describe("procedural Makarba demo buildings", () => {
  it("are deterministic, inside the demo area, clear of the lake, with heights derived from dummy levels", () => {
    const a = generateBuildings(), b = generateBuildings();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.features.length).toBeGreaterThan(300);
    const [[w, s], [e, n]] = MAKARBA_BOUNDS;
    const bad: string[] = [];
    for (const [i, f] of a.features.entries()) {
      const ring = (f.geometry.coordinates as [number, number][][])[0]!;
      if (ring.some(([x, y]) => x < w || x > e || y < s || y > n)) bad.push(`${i} outside the demo area`);
      if (ring.some((p) => inside(p, LAKE))) bad.push(`${i} reaches into the lake`);
      if (f.properties["h"] !== Math.round(Number(f.properties["levels"]) * 3.2)) bad.push(`${i} height does not follow levels`);
    }
    expect(bad).toEqual([]);
  });
});
