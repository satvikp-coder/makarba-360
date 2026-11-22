/**
 * Coordinate-system support for historical layer import. No dependency: only the three systems Gujarat sources use.
 * EPSG:4326 (WGS 84 longitude/latitude), EPSG:3857 (web mercator) and EPSG:32643 (WGS 84 / UTM zone 43N, central meridian 75 deg E,
 * which covers Ahmedabad). UTM uses the Kruger series (sub-millimetre inside a zone). Pure functions.
 */
export const SUPPORTED_CRS = ["EPSG:4326", "EPSG:3857", "EPSG:32643"] as const;
export type Crs = (typeof SUPPORTED_CRS)[number];

const A = 6378137;
const F = 1 / 298.257223563;
const N = F / (2 - F);
const K0 = 0.9996;
const E0 = 500000;
const LON0 = (75 * Math.PI) / 180;
const AA = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const ALPHA = [N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16 + (41 * N ** 4) / 180, (13 * N ** 2) / 48 - (3 * N ** 3) / 5 + (557 * N ** 4) / 1440, (61 * N ** 3) / 240 - (103 * N ** 4) / 140, (49561 * N ** 4) / 161280];
const BETA = [N / 2 - (2 * N ** 2) / 3 + (37 * N ** 3) / 96 - N ** 4 / 360, N ** 2 / 48 + N ** 3 / 15 - (437 * N ** 4) / 1440, (17 * N ** 3) / 480 - (37 * N ** 4) / 840, (4397 * N ** 4) / 161280];
const DELTA = [2 * N - (2 * N ** 2) / 3 - 2 * N ** 3 + (116 * N ** 4) / 45, (7 * N ** 2) / 3 - (8 * N ** 3) / 5 - (227 * N ** 4) / 45, (56 * N ** 3) / 15 - (136 * N ** 4) / 35, (4279 * N ** 4) / 630];
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Longitude/latitude (degrees) to UTM 43N easting/northing (metres). */
export function toUtm43(lng: number, lat: number): [number, number] {
  const phi = rad(lat), dl = rad(lng) - LON0;
  const c = (2 * Math.sqrt(N)) / (1 + N);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let e = eta, n = xi;
  ALPHA.forEach((a, i) => { const j = 2 * (i + 1); e += a * Math.cos(j * xi) * Math.sinh(j * eta); n += a * Math.sin(j * xi) * Math.cosh(j * eta); });
  return [E0 + K0 * AA * e, K0 * AA * n];
}

/** UTM 43N easting/northing (metres) to longitude/latitude (degrees). */
export function fromUtm43(x: number, y: number): [number, number] {
  const xi = y / (K0 * AA), eta = (x - E0) / (K0 * AA);
  let xp = xi, ep = eta;
  BETA.forEach((b, i) => { const j = 2 * (i + 1); xp -= b * Math.sin(j * xi) * Math.cosh(j * eta); ep -= b * Math.cos(j * xi) * Math.sinh(j * eta); });
  const chi = Math.asin(Math.sin(xp) / Math.cosh(ep));
  let phi = chi;
  DELTA.forEach((d, i) => { phi += d * Math.sin(2 * (i + 1) * chi); });
  return [deg(LON0 + Math.atan2(Math.sinh(ep), Math.cos(xp))), deg(phi)];
}

export function fromWebMercator(x: number, y: number): [number, number] {
  return [deg(x / A), deg(2 * Math.atan(Math.exp(y / A)) - Math.PI / 2)];
}
export function toWebMercator(lng: number, lat: number): [number, number] {
  return [A * rad(lng), A * Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2))];
}

/** One position to WGS 84 [longitude, latitude]. Throws on non-finite input. Longitude/latitude are rounded to 7 decimals (about 1 cm). */
export function toWgs84(crs: Crs, p: number[]): number[] {
  const [x, y] = p;
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("non-finite coordinate");
  const r = crs === "EPSG:4326" ? [x, y] : crs === "EPSG:3857" ? fromWebMercator(x, y) : fromUtm43(x, y);
  const round = (v: number) => Math.round(v * 1e7) / 1e7;
  return p.length === 3 ? [round(r[0]!), round(r[1]!), p[2]!] : [round(r[0]!), round(r[1]!)];
}

export function reprojectCoordinates(crs: Crs, c: unknown): unknown {
  if (Array.isArray(c) && typeof c[0] === "number") return toWgs84(crs, c as number[]);
  if (Array.isArray(c)) return c.map((x) => reprojectCoordinates(crs, x));
  return c;
}

/** Great-circle distance in metres between two WGS 84 positions. */
export function haversineMetres(a: readonly number[], b: readonly number[]): number {
  const R = 6371008.8, dLat = rad(b[1]! - a[1]!), dLng = rad(b[0]! - a[0]!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1]!)) * Math.cos(rad(b[1]!)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Shortest distance in metres from a point to a polyline, using a local equirectangular plane (accurate to well under 1% over a few km). */
export function distanceToLineMetres(p: readonly number[], line: readonly (readonly number[])[]): number {
  const k = Math.cos(rad(p[1]!)) * 111319.49, m = 110574;
  const px = p[0]! * k, py = p[1]! * m;
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = line[i]![0]! * k, ay = line[i]![1]! * m, bx = line[i + 1]![0]! * k, by = line[i + 1]![1]! * m;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}
