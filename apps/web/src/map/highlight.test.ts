import { describe, expect, it } from "vitest";
import type { PublicFeature } from "../api.js";
import { LAKE, ROZA_OUTLINE, type FC, type Pos } from "./basemap.js";
import { footprintAt, footprintData, footprintOf } from "./highlight.js";

const sq = (x: number, y: number, d = 0.0001): Pos[] => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];
const buildings: FC = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { h: 12 }, geometry: { type: "Polygon", coordinates: [sq(72.51, 22.99)] } },
  { type: "Feature", properties: { h: 30 }, geometry: { type: "Polygon", coordinates: [sq(72.512, 22.99)] } },
] };
const pt = (c: Pos) => ({ type: "Feature", id: "p", geometry: { type: "Point", coordinates: c }, properties: { name: "P", category: "market" } }) as unknown as PublicFeature;

describe("selection footprint", () => {
  it("Sarkhej Roza and its tank are outlined with their real OpenStreetMap shapes", () => {
    const roza = footprintAt([72.50539, 22.99342], buildings);   // the tour stop on the mosque
    expect(roza.kind).toBe("area");
    expect(roza.rings[0]).toEqual(expect.arrayContaining(ROZA_OUTLINE));
    const lake = footprintAt([72.5048, 22.9918], buildings);     // the tour stop on the tank
    expect(lake.rings[0]).toEqual(expect.arrayContaining(LAKE));
    expect(LAKE.length).toBeGreaterThan(5);
  });
  it("a point on a building outlines that building (with its height); a point beside one picks the nearest within ~40 m", () => {
    expect(footprintAt([72.51005, 22.99005], buildings)).toEqual({ kind: "building", rings: [sq(72.51, 22.99)], height: 12 });
    expect(footprintAt([72.5122, 22.99005], buildings)).toMatchObject({ kind: "building", height: 30 });   // ~10 m east of the second
  });
  it("a point far from any building gets a small ground ring, never an unrelated building", () => {
    const f = footprintAt([72.495, 22.98], buildings);
    expect(f.kind).toBe("ring");
    expect(f.rings[0]![0]).toEqual(f.rings[0]![f.rings[0]!.length - 1]);   // closed
  });
  it("areas and routes use the place's own geometry", () => {
    const area = { ...pt([0, 0]), geometry: { type: "Polygon", coordinates: [sq(72.5, 22.99)] } } as unknown as PublicFeature;
    const route = { ...pt([0, 0]), geometry: { type: "MultiLineString", coordinates: [[[72.5, 22.99], [72.51, 22.99]]] } } as unknown as PublicFeature;
    expect(footprintOf(area, buildings)).toEqual({ kind: "area", rings: [sq(72.5, 22.99)], height: 0 });
    expect(footprintOf(route, buildings)).toMatchObject({ kind: "route", rings: [[[72.5, 22.99], [72.51, 22.99]]] });
  });
  it("layer data: outlines always; the lit 3D body only for buildings and areas", () => {
    const b = footprintData(footprintAt([72.51005, 22.99005], buildings), "#c00");
    expect(b.lines.features).toHaveLength(1);
    expect(b.solid.features[0]!.properties).toMatchObject({ c: "#c00", h: 12, kind: "building" });
    expect(footprintData(footprintAt([72.495, 22.98], buildings), "#c00").solid.features).toHaveLength(0);
    expect(footprintData(null, "#c00").lines.features).toHaveLength(0);
  });
});
