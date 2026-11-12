import { describe, expect, it } from "vitest";
import { signal, summaryPrompt, upTo, type Series } from "./outlook.js";
import { scenarioFor } from "./scenario.js";

const s = (id: string, good: "up" | "down" | null, hist: number[], fc: number[], unit = "US$"): Series => ({ id, label: id, theme: "economic", unit, good,
  history: hist.map((value, i) => ({ year: 2015 + i, value })), forecast: fc.map((value, i) => ({ year: 2015 + hist.length + i, value, lo: value * 0.95, hi: value * 1.05 })) });

describe("outlook signals", () => {
  it("prefix of the forecast up to the end year", () => {
    expect(upTo(s("a", "up", [1, 2], [3, 4, 5]), 2018).forecast.map((p) => p.year)).toEqual([2017, 2018]);
  });
  it("verdict follows the desirable direction; tiny moves are neutral", () => {
    expect(signal(s("a", "up", [10, 11], [12, 13]), 2030)!.verdict).toBe("improving");
    expect(signal(s("a", "down", [10, 11], [12, 13]), 2030)!.verdict).toBe("worsening");
    expect(signal(s("a", "up", [100, 100], [100.5]), 2030)!.verdict).toBe("neutral");
  });
  it("momentum: faster forecast slope accelerates, opposite slope reverses", () => {
    expect(signal(s("a", null, [1, 2, 3, 4], [6, 8, 10]), 2030)!.momentum).toBe("accelerating");
    expect(signal(s("a", null, [1, 2, 3, 4], [3, 2, 1]), 2030)!.momentum).toBe("reversing");
  });
  it("prompt uses only given numbers", () => {
    const a = signal(s("x", "up", [1, 2], [3]), 2030)!;
    expect(summaryPrompt([a], 2034, "India")).toMatch(/x \(economic\): 2 in 2016 -> 3 in 2017/);
  });
});

describe("3D scenario", () => {
  const doc = (series: Series[]) => ({ generated: "", model: "", maxYear: 2050, region: "", source: "", disclaimer: "", series });
  it("rising GDP raises the corridor and redevelops plots; no data means no change", () => {
    const up = scenarioFor(doc([s("NY.GDP.PCAP.CD", "up", [1000, 1100], [1500, 2000])]), 2030);
    expect(up.corridorGrowth).toBeGreaterThan(1);
    expect(up.redevelop).toBeGreaterThan(0);
    expect(up.changes.map((c) => c.id)).toContain("corridor");
    const none = scenarioFor(doc([]), 2030);
    expect(none.corridorGrowth).toBe(1);
    expect(none.changes).toHaveLength(0);
  });
  it("prefers Ahmedabad PM2.5 over the national series for haze, and bounds it", () => {
    const sc = scenarioFor(doc([s("EN.ATM.PM25.MC.M3", "down", [50], [40], "µg/m³"), s("KAGGLE_AHD_PM2.5", "down", [80], [500], "µg/m³")]), 2030);
    expect(sc.haze).toBe(0.55);
    expect(sc.changes.find((c) => c.id === "haze")!.because).toMatch(/^Ahmedabad/);
  });
});
