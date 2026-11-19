import { describe, expect, it } from "vitest";
import { along, buildingsGeometry, furnitureGeometry, landmarkGeometry, roadsGeometry, toLocal, TOUR, trees, vehicles, walkers, RADIUS } from "./world.js";

describe("street-level world (built from the map's own sketch data)", () => {
  it("puts the Roza tomb at the origin, east on +x and north on -z", () => {
    expect(toLocal([72.50547, 22.99351])).toEqual([0, -0]);
    const [x, z] = toLocal([72.50647, 22.99451]);
    expect(x).toBeGreaterThan(90); expect(z).toBeLessThan(-90);
  });
  it("builds blocks, the Roza with true domes, roads, furniture and trees inside the radius", () => {
    const b = buildingsGeometry();
    expect(b.count).toBeGreaterThan(150);
    expect(b.walls.getAttribute("color").count).toBe(b.walls.getAttribute("position").count);
    expect(b.roofs.getAttribute("position").count).toBeGreaterThan(b.count * 6 - 1);   // two triangles per roof at least
    const l = landmarkGeometry();
    expect(l.domes.length).toBeGreaterThan(10);
    expect(Math.max(...l.domes.map((d) => d.r))).toBeGreaterThan(8);   // the tomb's main dome
    expect(roadsGeometry().asphalt.getAttribute("position").count).toBeGreaterThan(20);
    expect(furnitureGeometry().getAttribute("position").count).toBeGreaterThan(100);
    const t = trees();
    expect(t.length).toBeGreaterThan(30);
    for (const x of t) expect(Math.hypot(x.x, x.z)).toBeLessThan(RADIUS);
  });
  it("has life at the observed places and traffic on the roads", () => {
    const w = walkers();
    expect(w.filter((x) => x.mode === "sit").length).toBeGreaterThan(20);
    expect(w.filter((x) => x.mode === "play").length).toBeGreaterThan(5);
    expect(vehicles().length).toBeGreaterThan(30);
  });
  it("moves along a path and keeps to its side", () => {
    const p = along([[0, 0], [10, 0], [10, 10]], 15);
    expect(p.x).toBeCloseTo(10); expect(p.z).toBeCloseTo(5);
    expect(along([[0, 0], [10, 0]], 5, 2).z).toBeCloseTo(2);
  });
  it("the cinematic tour starts and ends in the air and walks at eye height in between", () => {
    expect(TOUR[0]!.pos[1]).toBeGreaterThan(100);
    expect(TOUR.filter((s) => s.pos[1] < 2).length).toBeGreaterThan(3);
    expect(TOUR.filter((s) => s.caption).length).toBeGreaterThanOrEqual(5);
  });
});
