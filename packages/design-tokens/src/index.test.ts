import { describe, expect, it } from "vitest";
import { approvedPairs, assertTextPair, contrast, palette, passesAA } from "./index.js";

describe("contrast", () => {
  it("computes known WCAG ratios", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("every approved pair meets AA for its use", () => {
    for (const p of approvedPairs) expect(passesAA(p.fg, p.bg, p.use), p.name).toBe(true);
  });
  it("rejects accent text failing AA (terracotta/lake on ivory, teal on accents)", () => {
    expect(() => assertTextPair(palette.terracotta, palette.ivory, "normal")).toThrow(/contrast failure/);
    expect(() => assertTextPair(palette.lake, palette.ivory, "normal")).toThrow();
    expect(() => assertTextPair(palette.teal, palette.lake, "normal")).toThrow();
    expect(() => assertTextPair(palette.teal, palette.terracotta, "normal")).toThrow();
  });
  it("rejects malformed colours", () => { expect(() => contrast("red", "#fff")).toThrow(); });
  it("prints the audit table", () => {
    for (const p of approvedPairs) console.log(p.name, contrast(p.fg, p.bg).toFixed(2));
  });
});
