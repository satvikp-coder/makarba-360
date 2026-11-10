import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { formatDated } from "./api.js";
import { PlaceProfile } from "./Profile.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const res = (b: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(b), { status: s }));
type H = { locations?: unknown; history?: unknown | number; media?: unknown | number };
const mk = (h: H = {}, log: string[] = []) => ((url: string) => {
  log.push(url);
  if (/\/locations\?/.test(url)) return res(h.locations ?? bundle.locations);
  if (/\/history$/.test(url)) return typeof h.history === "number" ? res({}, h.history) : res(h.history ?? bundle.history);
  if (/\/media\//.test(url)) return typeof h.media === "number" ? res({}, h.media) : res(h.media ?? bundle.media);
  return res({}, 404);
}) as unknown as typeof fetch;
const show = (slug: string, f: typeof fetch) => render(<MemoryRouter initialEntries={[`/places/${slug}`]}><Routes><Route path="/places/:slug" element={<PlaceProfile fetcher={f} />} /></Routes></MemoryRouter>);
afterEach(cleanup);

describe("place profile", () => {
  it("shows name, category, geometry kind, dated sourced history, photo credit and sources for a published place", async () => {
    show("synthetic-point", mk());
    expect(await screen.findByRole("heading", { level: 1, name: "Synthetic Atlas Point" })).toBeTruthy();
    expect(screen.getByText(/Mapped as a point/)).toBeTruthy();
    expect((await screen.findAllByText(/2021 \(year\)/)).length).toBeGreaterThan(0);           // year stays a year
    expect(screen.getByText(/Invented test citation/, { selector: "small" })).toBeTruthy();
    expect(await screen.findByAltText(/Synthetic panorama placeholder/)).toBeTruthy();
    expect(screen.getAllByText(/synthetic-test-only/, { selector: "small" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Example data: these entries are composite, fictional/)).toBeTruthy();
  });
  it("missing description, findings and counts are stated plainly and never as zero", async () => {
    const { container } = show("synthetic-point", mk());
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("No approved description has been published yet.")).toBeTruthy();
    expect(screen.getByText(/No findings are published for this place yet/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b0 (responses|respondents|interviews)/i);
  });
  it("an unknown or withdrawn place shows the safe not-found page with no name, history or media requests", async () => {
    const log: string[] = [];
    show("withdrawn-place", mk({}, log));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.queryByText("Synthetic Atlas Point")).toBeNull();
    expect(log.some((u) => /history|media/.test(u))).toBe(false);
  });
  it("a place that disappears from the published list is not-found even if history would still answer", async () => {
    show("synthetic-point", mk({ locations: { ...bundle.locations, features: [] } }));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.queryByText(/Invented test citation/)).toBeNull();
  });
  it("history 404 or empty says no verified history; history failure is a distinct message", async () => {
    show("synthetic-point", mk({ history: 404 }));
    expect(await screen.findByText("No verified history has been published yet.")).toBeTruthy();
    cleanup();
    show("synthetic-point", mk({ history: { ...bundle.history, events: [], sources: [], comparisonPairs: [] } }));
    expect(await screen.findByText("No verified history has been published yet.")).toBeTruthy();
    cleanup();
    show("synthetic-point", mk({ history: 503 }));
    expect(await screen.findByText("History could not be loaded.")).toBeTruthy();
  });
  it("an invalid history payload (contract violation) is not rendered", async () => {
    const bad = structuredClone(bundle.history); bad.events[0].participantName = "X";
    show("synthetic-point", mk({ history: bad }));
    expect(await screen.findByText("History could not be loaded.")).toBeTruthy();
    expect(screen.queryByText(/Synthetic account/)).toBeNull();
  });
  it("unavailable media is reported without a broken image; non-https media is never rendered", async () => {
    show("synthetic-point", mk({ media: 404 }));
    expect(await screen.findByText("A photograph is unavailable.")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("requests are public endpoints only", async () => {
    const log: string[] = [];
    show("synthetic-point", mk({}, log));
    await screen.findByAltText(/panorama/);
    for (const u of log) expect(u).toMatch(/^\/api\/v1\/public\/(locations(\?limit=\d+)?|locations\/[\w-]+\/history|media\/[\w-]+)$/);
  });
  it("shows the Then & Now comparison only when a comparison pair exists", async () => {
    show("synthetic-point", mk());
    expect(await screen.findByRole("slider", { name: "Compare before and after" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Then & Now" })).toBeTruthy();
    cleanup();
    show("synthetic-point", mk({ history: { ...bundle.history, comparisonPairs: [] } }));
    await screen.findByText(/Invented test citation/, { selector: "small" });
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Then & Now" })).toBeNull();
  });
  it("hides the comparison when one of its images is unavailable", async () => {
    const f = ((url: string) => (/media\/synthetic-after/.test(url) ? res({}, 404) : mk()(url))) as unknown as typeof fetch;
    show("synthetic-point", f);
    await screen.findByText(/Invented test citation/, { selector: "small" });
    await waitFor(() => expect(screen.queryByText("Loading comparison…")).toBeNull());
    expect(screen.queryByRole("slider")).toBeNull();
  });
  it("passes automated accessibility checks", async () => {
    const { container } = show("synthetic-point", mk());
    await screen.findByAltText(/panorama/);
    await waitFor(() => expect(container.querySelector(".panorama")).not.toBeNull());
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("formatDated", () => {
  it("never invents a precise date for unknown or imprecise values", () => {
    expect(formatDated({ value: null, precision: "unknown" })).toBe("Date unknown");
    expect(formatDated(undefined)).toBe("Date unknown");
    expect(formatDated({ value: "2021", precision: "year" })).toBe("2021 (year)");
    expect(formatDated({ value: "2026-01-01", precision: "day" })).toBe("2026-01-01 (exact day)");
  });
});
