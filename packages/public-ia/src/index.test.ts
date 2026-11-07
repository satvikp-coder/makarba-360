import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { forbiddenQueryKeys, mainNavigation, publicRoutes, sanitizeQuery } from "./index.js";

const inventory = readFileSync(fileURLToPath(new URL("../../../docs/product/screen-inventory.md", import.meta.url)), "utf8");
const publicIds = [...inventory.matchAll(/^\| (P\d\d) \|/gm)].map((m) => m[1]);

describe("public information architecture", () => {
  it("covers every public screen P01-P13 in the screen inventory", () => {
    expect(publicIds).toHaveLength(13);
    expect(publicRoutes.map((r) => r.id).sort()).toEqual([...publicIds].sort());
  });
  it("gives every route a non-map alternative and loading/empty/error states", () => {
    for (const r of publicRoutes) {
      expect(r.alternative.length, r.id).toBeGreaterThan(5);
      expect([...r.states].sort(), r.id).toEqual(["empty", "error", "loading"]);
    }
  });
  it("main navigation matches the design and every group has a route", () => {
    expect(mainNavigation).toEqual(["Explore", "Then & Now", "Community Voices", "Urban Insights", "Research"]);
    for (const g of mainNavigation) expect(publicRoutes.some((r) => r.nav === g), g).toBe(true);
  });
  it("has no public survey submission or anonymous write journey", () => {
    for (const r of publicRoutes) {
      expect(`${r.path} ${r.title}`.toLowerCase(), r.id).not.toMatch(/survey|submit|interview|respond|consent|login|admin|field/);
      for (const q of r.query) expect(forbiddenQueryKeys.some((f) => q.includes(f)), `${r.id}:${q}`).toBe(false);
    }
  });
  it("sanitizeQuery drops raw-research and unknown parameters", () => {
    const p = sanitizeQuery("P02", new URLSearchParams("q=lake&interview=7&lat=23.0&category=heritage&evil=1&gps=1"));
    expect(p.toString()).toBe("q=lake&category=heritage");
    expect(sanitizeQuery("P99", new URLSearchParams("q=a")).toString()).toBe("");
  });
});
