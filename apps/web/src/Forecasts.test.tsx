import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Forecasts, type ForecastDoc } from "./Forecasts.js";

const years = (from: number, to: number, f: (y: number) => number) => Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, value: f(from + i), lo: f(from + i) - 1, hi: f(from + i) + 1 }));
const mk = (id: string, theme: string, good: "up" | "down" | null, slope: number) => ({ id, label: id, theme, unit: "US$", good,
  history: years(2005, 2025, (y) => 100 + (y - 2005) * slope).map(({ year, value }) => ({ year, value })), forecast: years(2026, 2050, (y) => 100 + (y - 2005) * slope) });
const doc: ForecastDoc = { generated: "2026-11-12", model: "google/timesfm-2.5-200m-pytorch", maxYear: 2050, region: "India (national)", source: "WB", disclaimer: "Not a Makarba finding.",
  series: [mk("NY.GDP.PCAP.CD", "economic", "up", 5), mk("SL.UEM.TOTL.ZS", "economic", "down", 1), mk("SP.DYN.LE00.IN", "social", "up", 0.5)] };

let loc = "";
function Where() { loc = useLocation().search; return null; }
const fetcher = vi.fn(async (u: string) => (u.endsWith("forecasts.json") ? { ok: true, json: async () => doc } : { ok: false })) as unknown as typeof fetch;
const page = (url = "/forecasts") => render(<MemoryRouter initialEntries={[url]}><Forecasts fetcher={fetcher} /><Where /></MemoryRouter>);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Outlook", () => {
  it("defaults to 2034, and the slider moves the end year in the URL and the charts", async () => {
    page();
    expect(await screen.findByRole("heading", { level: 1, name: "Where the trends point by 2034" })).toBeTruthy();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2040" } });
    expect(screen.getByRole("heading", { level: 1, name: "Where the trends point by 2040" })).toBeTruthy();
    expect(loc).toBe("?year=2040");
    expect(screen.getAllByRole("img")[0]!.getAttribute("aria-label")).toMatch(/forecast to 2040/);
  });
  it("judges direction: rising GDP improves, rising unemployment worsens; filters by theme", async () => {
    page();
    await screen.findAllByRole("img");
    const card = (name: string) => screen.getByRole("heading", { level: 3, name }).closest("article")!;
    expect(card("NY.GDP.PCAP.CD").textContent).toMatch(/improving/);
    expect(card("SL.UEM.TOTL.ZS").textContent).toMatch(/worsening/);
    await userEvent.click(screen.getByRole("button", { name: /^social/ }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
  it("ignores an out-of-range year in the URL", async () => {
    page("/forecasts?year=1999");
    expect(await screen.findByRole("heading", { level: 1, name: /by 2034/ })).toBeTruthy();
  });
  it("AI tab says how to get a local model when Ollama is not running; model tab names TimesFM", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    page();
    await userEvent.click(await screen.findByRole("tab", { name: "AI insights" }));
    expect(await screen.findByText(/Apple Intelligence isn't reachable/)).toBeTruthy();   // on-device Apple model is tried first
    await userEvent.click(screen.getByRole("radio", { name: "On-device (Ollama)" }));
    expect(await screen.findByText(/No local model found/)).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Model & data" }));
    expect(screen.getByText(/TimesFM 2.5/)).toBeTruthy();
  });
  it("shows an alert when the forecast file is missing", async () => {
    render(<MemoryRouter><Forecasts fetcher={(async () => ({ ok: false })) as unknown as typeof fetch} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});

it("theme tile filters and 'Show all themes' resets", async () => {
  page();
  await screen.findAllByRole("img");
  await userEvent.click(screen.getByRole("button", { name: /^economic 1 of 2 improving/ }));
  expect(screen.getAllByRole("img")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Show all themes" }));
  expect(screen.getAllByRole("img")).toHaveLength(3);
  cleanup();
});
