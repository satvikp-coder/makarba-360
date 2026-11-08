import { describe, expect, it } from "vitest";
import { clusterPoints, featureBbox, normalise, parseBbox, searchFeatures, type PublicFeatureLike } from "./index.js";

// Synthetic features around [10,10] (not Makarba).
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pt = (n: number, x: number, y: number, name = `Point ${n}`, category = "heritage", extra: Record<string, unknown> = {}): PublicFeatureLike =>
  ({ type: "Feature", id: id(n), geometry: { type: "Point", coordinates: [x, y] }, properties: { slug: `p${n}`, name, category, ...extra } });
const line: PublicFeatureLike = { type: "Feature", id: id(50), geometry: { type: "MultiLineString", coordinates: [[[10.0, 10.0], [10.2, 10.0]]] }, properties: { slug: "road", name: "Synthetic Road", category: "transport" } };
const area: PublicFeatureLike = { type: "Feature", id: id(60), geometry: { type: "MultiPolygon", coordinates: [[[[10.5, 10.5], [10.6, 10.5], [10.6, 10.6], [10.5, 10.5]]]] }, properties: { slug: "lake", name: { en: "Synthetic Lake", gu: "તળાવ" }, category: "community" } };
const all = [pt(3, 10.01, 10.01), pt(1, 10.011, 10.011), pt(2, 10.9, 10.9, "Café Étoile"), line, area];

describe("parseBbox", () => {
  it("accepts a valid box", () => { expect(parseBbox("10,10,10.5,10.5")).toEqual({ ok: true, value: [10, 10, 10.5, 10.5] }); });
  it.each([
    [null, /required/], ["", /required/], ["1,2,3", /four numbers/], ["1,2,3,4,5", /four numbers/], ["a,b,c,d", /plain decimal/], ["1,2,,4", /plain decimal/],
    ["1e3,2,3,4", /plain decimal/], ["NaN,2,3,4", /plain decimal/], ["Infinity,0,1,1", /plain decimal/],
    ["-181,0,1,1", /-180..180/], ["0,0,181,1", /-180..180/], ["0,-91,1,1", /-90..90/], ["0,0,1,91", /-90..90/],
    ["10,10,10,11", /positive width/], ["10,10,11,10", /positive width/], ["11,10,10,11", /antimeridian/], ["10,12,11,11", /positive width/],
  ] as const)("rejects %s", (raw, re) => {
    const r = parseBbox(raw as string | null);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.message).toMatch(re); expect(r.error.code).toBe("invalid_bbox"); expect(r.error.fieldErrors["bbox"]).toBeTruthy(); }
  });
  it("antimeridian-crossing box (west 179, east -179) is rejected with advice, not silently flipped", () => {
    const r = parseBbox("179,0,-179,1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("two separate boxes");
  });
  it("a box exactly at the span limit is allowed; just over is not; a whole-world box is not", () => {
    expect(parseBbox("0,0,2,2").ok).toBe(true);
    expect(parseBbox("0,0,2.0001,1").ok).toBe(false);
    expect(parseBbox("-180,-90,180,90").ok).toBe(false);
  });
});

describe("searchFeatures", () => {
  it("returns stable order by id regardless of input order, with total", () => {
    const a = searchFeatures(all, {}); const b = searchFeatures([...all].reverse(), {});
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) { expect(a.value.features.map((f) => f.id)).toEqual(b.value.features.map((f) => f.id)); expect(a.value.total).toBe(5); expect(a.value.features[0]!.id).toBe(id(1)); }
  });
  it("bbox keeps features that intersect, including lines and areas that cross the box", () => {
    const r = searchFeatures(all, { bbox: [10.05, 9.9, 10.1, 10.1] });
    expect(r.ok && r.value.features.map((f) => f.id)).toEqual([id(50)]); // only the road crosses this box
  });
  it("zero matches is a successful empty result, not an error", () => {
    const r = searchFeatures(all, { bbox: [50, 50, 51, 51] });
    expect(r).toEqual({ ok: true, value: { features: [], total: 0, nextCursor: null, dropped: 0 } });
  });
  it("name, alias, localized name and slug search ignores case, accents and spacing", () => {
    const names = (q: string) => { const r = searchFeatures([...all, pt(7, 10, 10, "X", "heritage", { aliases: ["Old Gate"] })], { q }); return r.ok ? r.value.features.map((f) => f.id) : null; };
    expect(names("cafe etoile")).toEqual([id(2)]);
    expect(names("  SYNTHETIC   lake ")).toEqual([id(60)]);
    expect(names("તળાવ")).toEqual([id(60)]);
    expect(names("old gate")).toEqual([id(7)]);
    expect(names("road")).toEqual([id(50)]);
    expect(names("zzz")).toEqual([]);
    expect(normalise("Ǻ  É")).toBe("a e");
  });
  it("category filter, combined with q and bbox, is AND", () => {
    const r = searchFeatures(all, { categories: ["heritage"], q: "point", bbox: [10, 10, 10.02, 10.02] });
    expect(r.ok && r.value.features.map((f) => f.id)).toEqual([id(1), id(3)]);
  });
  it("paginates with a stable cursor and no overlap or gaps", () => {
    const p1 = searchFeatures(all, { limit: 2 });
    expect(p1.ok && p1.value.features.map((f) => f.id)).toEqual([id(1), id(2)]);
    if (!p1.ok) return;
    const p2 = searchFeatures(all, { limit: 2, after: p1.value.nextCursor! });
    expect(p2.ok && p2.value.features.map((f) => f.id)).toEqual([id(3), id(50)]);
    if (!p2.ok) return;
    const p3 = searchFeatures(all, { limit: 2, after: p2.value.nextCursor! });
    expect(p3.ok && [p3.value.features.map((f) => f.id), p3.value.nextCursor]).toEqual([[id(60)], null]);
  });
  it("rejects bad limit, over-long q and malformed cursor", () => {
    for (const limit of [0, -1, 201, 1.5, NaN]) { const r = searchFeatures(all, { limit }); expect(!r.ok && r.error.code).toBe("invalid_limit"); }
    const q = searchFeatures(all, { q: "x".repeat(101) }); expect(!q.ok && q.error.code).toBe("invalid_query");
    const c = searchFeatures(all, { after: "'; DROP TABLE" }); expect(!c.ok && c.error.code).toBe("invalid_cursor");
    expect(searchFeatures(all, { limit: 200 }).ok).toBe(true);
  });
  it("drops features with restricted fields or broken geometry and counts them; duplicates collapse", () => {
    const leaky = pt(9, 10, 10, "Leaky", "heritage", { interviewLatitude: 10.123 });
    const broken: PublicFeatureLike = { ...pt(8, 10, 10), geometry: { type: "Point", coordinates: [Infinity, 1] } };
    const r = searchFeatures([...all, leaky, broken, pt(1, 10.011, 10.011)], {});
    expect(r.ok && [r.value.total, r.value.dropped]).toEqual([5, 2]);
    expect(r.ok && JSON.stringify(r.value.features)).not.toContain("interviewLatitude");
  });
  it("featureBbox handles each geometry type and rejects malformed coordinates", () => {
    expect(featureBbox(line)).toEqual([10, 10, 10.2, 10]);
    expect(featureBbox(area)).toEqual([10.5, 10.5, 10.6, 10.6]);
    expect(featureBbox({ ...line, geometry: { type: "MultiLineString", coordinates: [] } })).toBeNull();
    expect(featureBbox({ ...line, geometry: { type: "MultiLineString", coordinates: [[["a", 1]]] } })).toBeNull();
  });
});

describe("clusterPoints", () => {
  it("nearby points cluster at low zoom and separate at high zoom; lines and areas are never clustered", () => {
    const low = clusterPoints(all, 8);
    expect(low.ok).toBe(true);
    if (!low.ok) return;
    expect(low.value.clusters.map((c) => c.count)).toEqual([2]);
    expect(low.value.clusters[0]!.memberIds).toEqual([id(1), id(3)]);
    expect(low.value.singles.map((f) => f.id)).toEqual([id(2)]);
    expect(low.value.others.map((f) => f.id)).toEqual([id(50), id(60)]);
    const high = clusterPoints(all, 20);
    expect(high.ok && [high.value.clusters.length, high.value.singles.length]).toEqual([0, 3]);
  });
  it("every point appears exactly once (in a cluster or as a single) so none vanish or double", () => {
    for (const z of [0, 5, 10, 15, 20]) {
      const r = clusterPoints(all, z);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const ids = [...r.value.clusters.flatMap((c) => c.memberIds), ...r.value.singles.map((s) => s.id)].sort();
        expect(ids).toEqual([id(1), id(2), id(3)]);
        expect(r.value.clusters.reduce((n, c) => n + c.count, 0) + r.value.singles.length).toBe(3);
      }
    }
  });
  it("cluster ids are stable: same members give the same id regardless of input order", () => {
    const a = clusterPoints(all, 8); const b = clusterPoints([...all].reverse(), 8);
    expect(a.ok && b.ok && a.value.clusters[0]!.clusterId).toBe(b.ok && a.ok && b.value.clusters[0]!.clusterId);
    expect(a.ok && a.value.clusters[0]!.clusterId).toMatch(/^c-[0-9a-f]{8}$/);
    if (a.ok) expect(a.value.clusters[0]!.center[0]).toBeCloseTo(10.0105, 4);
  });
  it("empty input is a successful empty result", () => { expect(clusterPoints([], 5)).toEqual({ ok: true, value: { clusters: [], singles: [], others: [] } }); });
  it("rejects invalid zoom values", () => { for (const z of [-1, 23, NaN, Infinity]) { const r = clusterPoints(all, z); expect(!r.ok && r.error.code).toBe("invalid_zoom"); } });
  it("never emits restricted fields, and skips features with non-finite coordinates", () => {
    const leaky = pt(9, 10.0111, 10.0111, "Leaky", "heritage", { interviewLongitude: 1 });
    const broken: PublicFeatureLike = { ...pt(8, 10, 10), geometry: { type: "Point", coordinates: [NaN, 1] } };
    const r = clusterPoints([...all, leaky, broken], 8);
    expect(r.ok && JSON.stringify(r.value)).not.toContain("interviewLongitude");
    expect(r.ok && r.value.clusters[0]!.memberIds).toEqual([id(1), id(3)]);
  });
});
