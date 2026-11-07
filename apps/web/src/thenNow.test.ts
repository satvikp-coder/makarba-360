import { describe, expect, it } from "vitest";
import { sliderKey, viewPair, type PairInput } from "./thenNow.js";

const ok: PairInput = { id: "p", beforeDate: { value: "2021", precision: "year" }, afterDate: { value: "2026-01-01", precision: "day" }, sourceIds: ["s"], matchingViewpointNotes: "Same lamp post in frame", evidenceQuality: "good" };

describe("Then & Now pair view (synthetic)", () => {
  it("shows an eligible pair with precision-aware dates and a matched viewpoint", () => {
    const v = viewPair(ok, true);
    expect(v.eligible).toBe(true);
    expect(v.beforeLabel).toBe("2021 (year)");
    expect(v.afterLabel).toBe("2026-01-01 (exact day)");
    expect(v.viewpoint).toBe("matched");
  });
  it("an unknown date is never shown as 2021 and the pair is hidden", () => {
    for (const d of [{ value: null, precision: "unknown" }, { value: "", precision: "year" }, { value: "2021", precision: "unknown" }]) {
      const v = viewPair({ ...ok, beforeDate: d }, true);
      expect(v.eligible).toBe(false);
      expect(v.reason).toBe("unknown date");
    }
    expect(viewPair({ ...ok, beforeDate: { value: null, precision: "unknown" } }, true).beforeLabel).toBe("Date unknown");
  });
  it("hidden without a source or without both images", () => {
    expect(viewPair({ ...ok, sourceIds: [] }, true).reason).toBe("no source");
    expect(viewPair(ok, false).reason).toBe("media unavailable");
  });
  it("without a documented matching note it must not claim the same angle", () => {
    for (const n of ["", "  ", "Not matched: different height"]) {
      const v = viewPair({ ...ok, matchingViewpointNotes: n }, true);
      expect(v.viewpoint).toBe("not-matched");
      expect(v.viewpointText).toMatch(/not documented as taken from the same viewpoint/);
    }
  });
  it("always provides a text alternative with dates, quality and viewpoint", () => {
    const t = viewPair(ok, true).textAlternative;
    for (const s of ["2021 (year)", "2026-01-01", "good", "Matched viewpoint"]) expect(t).toContain(s);
    expect(viewPair({ ...ok, sourceIds: [] }, true).textAlternative.length).toBeGreaterThan(10);
  });
  it("slider keyboard model covers arrows, page keys, home/end, clamps, ignores other keys", () => {
    expect(sliderKey(50, "ArrowRight")).toBe(55);
    expect(sliderKey(50, "ArrowLeft")).toBe(45);
    expect(sliderKey(98, "ArrowRight")).toBe(100);
    expect(sliderKey(2, "ArrowLeft")).toBe(0);
    expect(sliderKey(50, "PageUp")).toBe(75);
    expect(sliderKey(10, "PageDown")).toBe(0);
    expect(sliderKey(50, "Home")).toBe(0);
    expect(sliderKey(50, "End")).toBe(100);
    expect(sliderKey(50, "a")).toBeNull();
  });
});
