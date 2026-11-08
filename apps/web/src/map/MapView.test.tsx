import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  fire(ev: string, e?: unknown) { (this.handlers[ev] ?? []).forEach((f) => f(e)); }
  addSource(id: string, o: Record<string, unknown>) { this.sources[id] = o; }
  fitBounds(...a: unknown[]) { this.fitted.push(a); }
  easeTo(o: unknown) { this.eased.push(o); }
  addLayer(l: { id: string }) { this.layers.push(l); }
  getLayer(id: string) { return this.layers.find((l) => l.id === id); }
  getSource() { return { setData: (d: unknown) => { this.data = d; }, getClusterExpansionZoom: () => Promise.resolve(13) }; }
  setPaintProperty() {}
  remove() { this.removed = true; }
}
self = { maps: [] as FakeMap[], throwOnCreate: false, attrib: [] as unknown[], FakeMap } as typeof self & { attrib: unknown[]; FakeMap: typeof FakeMap };
return self as typeof self & { maps: FakeMap[]; attrib: unknown[]; FakeMap: typeof FakeMap };
});
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(), Map: h.FakeMap, NavigationControl: class {}, AttributionControl: class { constructor(o: unknown) { h.attrib.push(o); } },
}));
import { MapView, boundsOf, buildStyle, DEFAULT_TILE_URL } from "./MapView.js";
import type { PublicFeature } from "../api.js";

const feats: PublicFeature[] = [
  { type: "Feature", id: "00000000-0000-4000-8000-000000000001", geometry: { type: "Point", coordinates: [10, 10] }, properties: { slug: "s", name: "Synthetic", category: "heritage" } },
];
beforeEach(() => { h.attrib.length = 0; h.maps.length = 0; h.throwOnCreate = false; });
afterEach(cleanup);

describe("MapView", () => {
  it("creates one map with OSM and source attribution, then loads point/line/fill layers and data", async () => {
    const onStatus = vi.fn();
    render(<MapView features={feats} sourceAttribution="Demonstration place data" onStatus={onStatus} />);
    const m = h.maps[0]!;
    expect(h.attrib).toContainEqual({ compact: false, customAttribution: "Demonstration place data" });
    const style = JSON.stringify(m.opts.style as ReturnType<typeof buildStyle>);
    expect(style).toContain("OpenStreetMap contributors");
    expect(style).toContain(DEFAULT_TILE_URL);
    m.fire("load");
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    expect(m.layers.map((l) => l.id)).toEqual(["places-fill", "places-line", "places-cluster", "places-point"]);
    expect(Object.keys(m.sources)).toEqual(["places"]);
    expect(m.sources["places"]!.cluster).toBe(true);
    await waitFor(() => expect((m.data as { features: unknown[] }).features).toHaveLength(1));
    expect(screen.getByRole("region", { name: /Interactive map/ })).toBeTruthy();
  });
  it("selecting a point on the map reports the public feature id", () => {
    const onSelect = vi.fn();
    render(<MapView features={feats} sourceAttribution="x" onSelect={onSelect} />);
    const m = h.maps[0]!;
    m.fire("load");
    m.fire("click:places-point", { features: [{ properties: { locationId: feats[0]!.id } }] });
    expect(onSelect).toHaveBeenCalledWith(feats[0]!.id);
  });
  it("WebGL unsupported: shows the list-alternative message and does not throw", () => {
    h.throwOnCreate = true;
    const onStatus = vi.fn();
    render(<MapView features={feats} sourceAttribution="x" onStatus={onStatus} />);
    expect(onStatus).toHaveBeenCalledWith("unavailable");
    expect(screen.getByRole("status").textContent).toMatch(/list of places below/);
    expect(screen.queryByRole("region", { name: /Interactive map/ })).toBeNull();
  });
  it("renderer/context loss switches to the accessible alternative", async () => {
    render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    m.fire("load");
    m.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect((await screen.findByRole("status")).textContent).toMatch(/map is unavailable/);
  });
  it("zooms into a cluster when it is clicked and fits the view to the data", async () => {
    render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    m.fire("load");
    await waitFor(() => expect(m.fitted.length).toBe(1));
    m.fire("click:places-cluster", { features: [{ properties: { cluster_id: 7 } }], lngLat: { lng: 1, lat: 2 } });
    await waitFor(() => expect(m.eased).toEqual([{ center: [1, 2], zoom: 13 }]));
  });
  it("computes bounds over points, lines and polygons and returns null for no data", () => {
    expect(boundsOf([])).toBeNull();
    const f = (g: unknown) => ({ type: "Feature", id: "i", geometry: g, properties: { slug: "s", name: "n", category: "c" } }) as PublicFeature;
    expect(boundsOf([f({ type: "Point", coordinates: [1, 2] }), f({ type: "LineString", coordinates: [[0, 5], [3, -1]] }), f({ type: "Polygon", coordinates: [[[-2, 0], [4, 0], [4, 9], [-2, 0]]] })])).toEqual([[-2, -1], [4, 9]]);
  });
  it("removes the map on unmount", () => {
    const { unmount } = render(<MapView features={feats} sourceAttribution="x" />);
    const m = h.maps[0]!;
    unmount();
    expect(m.removed).toBe(true);
  });
});
