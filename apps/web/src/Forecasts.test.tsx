import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Forecasts, type ForecastDoc } from "./Forecasts.js";

const mk = (id: string, theme: string) => ({ id, label: id, theme, unit: "u",
  history: [{ year: 2022, value: 1 }, { year: 2023, value: 2 }],
  forecast: [{ year: 2024, value: 3, lo: 2, hi: 4 }, { year: 2025, value: 4, lo: 2, hi: 6 }] });
const doc: ForecastDoc = { generated: "2026-11-12", model: "m", horizon: 2, region: "India (national)", source: "WB", disclaimer: "Not a Makarba finding.", series: [mk("GDP", "economic"), mk("Life", "social")] };
afterEach(() => vi.unstubAllGlobals());

describe("Forecasts", () => {
  it("renders charts, disclaimer and filters by theme", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => doc }));
    render(<Forecasts />);
    expect(await screen.findByText(/Not a Makarba finding/)).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "social" }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
  it("shows an alert when the file is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<Forecasts />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
