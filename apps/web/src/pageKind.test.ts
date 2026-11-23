import { describe, expect, it } from "vitest";
import { pageKind } from "./Shell.js";

describe("pageKind (shared by the page shell and the background map)", () => {
  it("knows the four map pages", () => {
    expect(["/", "/explore", "/forecasts", "/street"].map(pageKind)).toEqual(["home", "explore", "outlook", "street"]);
  });
  it("treats every other route, including the Past page and routes added later, as a reading page", () => {
    // /past was missing from the map's own reader list, so the map drew its legend, time dock and AI card over the article.
    for (const p of ["/past", "/voices", "/insights", "/research/sources", "/places/x", "/stories/index", "/some-future-page"]) expect(pageKind(p)).toBe("reader");
  });
});
