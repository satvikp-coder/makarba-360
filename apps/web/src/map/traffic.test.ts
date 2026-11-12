import { describe, expect, it } from "vitest";
import { makeVehicles, PATHS, step, toFeatures } from "./traffic.js";

describe("3D traffic", () => {
  it("makes the requested number of vehicles, each on a real path, with a body and a headlight", () => {
    const vs = makeVehicles(40, 3);
    expect(vs).toHaveLength(40);
    for (const v of vs) { expect(PATHS[v.path]).toBeDefined(); expect(v.s).toBeGreaterThanOrEqual(0); expect(v.s).toBeLessThanOrEqual(PATHS[v.path]!.len); }
    const f = toFeatures(vs);
    expect(f.bodies.features).toHaveLength(40);
    expect(f.lights.features).toHaveLength(40);
    expect(f.bodies.features.every((b) => b.geometry.type === "Polygon" && b.geometry.coordinates[0]!.length === 5)).toBe(true);
  });
  it("drives on the left: a northbound highway vehicle sits west of the centre line", () => {
    const north = PATHS.findIndex((p) => p.kind === "highway" && p.pts[p.pts.length - 1]![1] > p.pts[0]![1]);
    const v = { path: north, s: 200, v: 10, kind: "car" as const, color: "#fff", lane: 0 };
    const ring = (toFeatures([v]).bodies.features[0]!.geometry as { coordinates: [number, number][][] }).coordinates[0]!;
    const cx = ring.slice(0, 4).reduce((a, p) => a + p[0], 0) / 4;
    const centre = 72.511 + (72.5122 - 72.511) * (200 / PATHS[north]!.cum[1]!);
    expect(cx).toBeLessThan(centre);
  });
  it("moves forward, wraps at the end of its path, and congestion slows everyone", () => {
    const a = makeVehicles(1, 5), b = makeVehicles(1, 5);
    const s0 = a[0]!.s;
    step(a, 1, 1); step(b, 1, 4);
    const da = (a[0]!.s - s0 + PATHS[a[0]!.path]!.len) % PATHS[a[0]!.path]!.len, db = (b[0]!.s - s0 + PATHS[b[0]!.path]!.len) % PATHS[b[0]!.path]!.len;
    expect(da).toBeGreaterThan(0);
    expect(db).toBeCloseTo(da / 2, 5);
    a[0]!.s = PATHS[a[0]!.path]!.len - 0.5; step(a, 1);
    expect(a[0]!.s).toBeLessThan(PATHS[a[0]!.path]!.len);
  });
});
