import { describe, expect, it } from "vitest";
import { distanceToLineMetres, fromUtm43, fromWebMercator, haversineMetres, reprojectCoordinates, toUtm43, toWebMercator, toWgs84 } from "./projection.js";

describe("UTM zone 43N (EPSG:32643)", () => {
  it("puts the central meridian at the false easting and the equator at zero northing", () => {
    const [x, y] = toUtm43(75, 0);
    expect(x).toBeCloseTo(500000, 3);
    expect(y).toBeCloseTo(0, 3);
  });
  it("matches the transverse Mercator equator formula k0 * a * atanh(sin(dLon)) one degree east of the meridian", () => {
    const expected = 0.9996 * 6378137 * Math.atanh(Math.sin(Math.PI / 180));
    expect(Math.abs(toUtm43(76, 0)[0] - 500000 - expected)).toBeLessThan(1);
  });
  it("round-trips Sarkhej Roza to well under a millimetre", () => {
    const [x, y] = toUtm43(72.50539, 22.99342);
    const [lng, lat] = fromUtm43(x, y);
    expect(lng).toBeCloseTo(72.50539, 9);
    expect(lat).toBeCloseTo(22.99342, 9);
    expect(x).toBeGreaterThan(200000); expect(x).toBeLessThan(300000); // 2.5 degrees west of the 75 E meridian
    expect(y).toBeGreaterThan(2_500_000); expect(y).toBeLessThan(2_600_000);
  });
});

describe("web mercator (EPSG:3857)", () => {
  it("round-trips", () => {
    const [x, y] = toWebMercator(72.5, 23);
    const [lng, lat] = fromWebMercator(x, y);
    expect(lng).toBeCloseTo(72.5, 9); expect(lat).toBeCloseTo(23, 9);
  });
});

describe("toWgs84 and reprojectCoordinates", () => {
  it("passes WGS 84 through, rounded to 7 decimals", () => expect(toWgs84("EPSG:4326", [72.505391234567, 22.99342])).toEqual([72.5053912, 22.99342]));
  it("keeps an elevation value untouched", () => expect(toWgs84("EPSG:4326", [72.5, 23, 41])[2]).toBe(41));
  it("rejects non-finite input", () => { expect(() => toWgs84("EPSG:3857", [NaN, 1])).toThrow(); expect(() => toWgs84("EPSG:3857", [1])).toThrow(); });
  it("reprojects nested coordinate arrays", () => {
    const [x, y] = toUtm43(72.5, 23);
    const r = reprojectCoordinates("EPSG:32643", [[[x, y], [x + 100, y]]]) as number[][][];
    expect(r[0]![0]![0]).toBeCloseTo(72.5, 6);
    expect(r[0]![1]![0]).toBeGreaterThan(72.5);
  });
});

describe("distances", () => {
  it("measures a degree of latitude as about 111 km", () => expect(haversineMetres([72.5, 22], [72.5, 23])).toBeGreaterThan(111000));
  it("finds the distance from a point to a line, clamped to the segment ends", () => {
    const line = [[72.5, 23], [72.51, 23]];
    expect(distanceToLineMetres([72.505, 23.001], line)).toBeGreaterThan(105);
    expect(distanceToLineMetres([72.505, 23.001], line)).toBeLessThan(115);
    expect(distanceToLineMetres([72.52, 23], line)).toBeCloseTo(distanceToLineMetres([72.52, 23], [[72.51, 23], [72.51, 23]]), 3);
    expect(distanceToLineMetres([72.5, 23], [[72.5, 23], [72.51, 23]])).toBeCloseTo(0, 6);
  });
});
