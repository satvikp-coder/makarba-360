import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { FuturePanel } from "./FuturePanel.js";
import { MapProvider, useMapState } from "./mapCtx.js";
import { scenarioFor } from "./scenario.js";
import type { ForecastDoc } from "./outlook.js";

const doc = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/forecasts.json"), "utf8")) as ForecastDoc;
afterEach(cleanup);

let flown: [number, number] | null = null;
function Harness({ year }: { year: number | null }) {
  const m = useMapState();
  useEffect(() => { m.setScenario(year ? scenarioFor(doc, year) : null); }, [year]);
  flown = m.flyTo;
  return <FuturePanel />;
}
const show = (year: number | null) => render(<MemoryRouter><MapProvider><Harness year={year} /></MapProvider></MemoryRouter>);

describe("future panel", () => {
  it("explains every change through people: who gains, who bears the cost, and the right-to-the-city question", () => {
    show(2034);
    expect(screen.getByRole("heading", { level: 2, name: "Makarba in 2034" })).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    const lensed = items.filter((li) => li.querySelector(".people-lens"));
    expect(lensed.length).toBe(items.length);
    for (const li of lensed) for (const t of ["Who gains", "Who bears the cost", "Right to the city"]) expect(within(li).getByText(t)).toBeTruthy();
    expect(screen.getByRole("link", { name: /All indicators and the AI briefing/ }).getAttribute("href")).toBe("/forecasts");
  });
  it("each change can fly the camera to where it happens", () => {
    show(2040);
    const first = scenarioFor(doc, 2040).changes[0]!;
    fireEvent.click(screen.getByRole("button", { name: `Show ${first.title} on the map` }));
    expect(flown).toEqual(first.at);
    expect(screen.getByRole("link", { name: /All indicators/ }).getAttribute("href")).toBe("/forecasts?year=2040");
  });
  it("without a scenario it shows a loading state, not an empty panel", () => {
    show(null);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
