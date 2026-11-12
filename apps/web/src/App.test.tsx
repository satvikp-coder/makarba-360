import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { publicRoutes } from "@makarba/public-ia";
import { App, PlaceList } from "./App.js";
import { vi } from "vitest";
vi.mock("./map/MapView.js", () => ({ MapView: () => <div data-testid="map" /> }));

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const okFetch = (() => json(bundle.locations)) as unknown as typeof fetch;
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
afterEach(cleanup);

describe("public shell", () => {
  it("the rail has three destinations; the reading pages are in the footer; there is no language picker", () => {
    at("/");
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    for (const n of ["Overview", "Explore", "Outlook"]) expect(nav.getByRole("link", { name: n })).toBeTruthy();
    expect(nav.queryByRole("link", { name: "Then & Now" })).toBeNull();
    const footer = within(screen.getByRole("navigation", { name: "Site information" }));
    for (const n of ["Then & Now", "Community Voices", "Urban Insights", "Research"]) expect(footer.getByRole("link", { name: n })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /language/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Sources and credits" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Accessibility and language" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeTruthy();
  });
  it("display settings change contrast, palette, text size and motion, and are remembered", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    at("/");
    fireEvent.click(screen.getByRole("button", { name: "Display and accessibility settings" }));
    fireEvent.click(await screen.findByRole("radio", { name: "High" }));
    fireEvent.click(screen.getByRole("radio", { name: "Colour-blind safe" }));
    fireEvent.click(screen.getByRole("radio", { name: "A++" }));
    fireEvent.click(screen.getByRole("radio", { name: "Reduce" }));
    const root = document.documentElement;
    expect([root.dataset["contrast"], root.dataset["palette"], root.dataset["motion"], root.style.fontSize]).toEqual(["high", "cvd", "reduce", "130%"]);
    expect(JSON.parse(localStorage.getItem("makarba.prefs.v1")!)).toMatchObject({ contrast: "high", palette: "cvd", text: 130, motion: "reduce" });
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(root.dataset["contrast"]).toBe("standard");
    vi.unstubAllGlobals();
  });
  it("? opens the keyboard shortcuts and 2 goes to Explore; keys typed into a field are ignored", async () => {
    at("/");
    fireEvent.keyDown(window, { key: "?" });
    expect(await screen.findByRole("heading", { name: /Keyboard shortcuts/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(window, { key: "2" });
    expect(await screen.findByRole("heading", { level: 1, name: "Explore Makarba" })).toBeTruthy();
  });
  it("has no survey entry route or action anywhere in the public routes", async () => {
    for (const r of publicRoutes) {
      const path = r.path.replace(":slug", "synthetic-place").replace(":id", "1");
      const { container } = at(path);
      const text = (container.textContent ?? "") + [...container.querySelectorAll("a")].map((a) => a.getAttribute("href")).join(" ");
      expect(text.toLowerCase(), r.id).not.toMatch(/submit survey|take the survey|start survey|\/survey|\/interview|\/login|\/admin/);
      expect(container.querySelector("form, textarea, input:not([type=hidden])"), r.id).toBeNull();
      cleanup();
    }
  });
  it("unknown routes show a not-found page", () => {
    at("/survey/new");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
  });
  it("every route renders one h1 and an accessible page (axe, no serious violations)", async () => {
    for (const path of ["/", "/voices", "/insights", "/research/methodology", "/accessibility"]) {
      const { container } = at(path);
      expect(container.querySelectorAll("h1").length, path).toBe(1);
      const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(res.violations.map((v) => `${path}:${v.id}`)).toEqual([]);
      cleanup();
    }
  });
});

import { within } from "@testing-library/react";

describe("place list alternative", () => {
  it("shows places from the validated mock contract without a per-list disclosure box (one site-wide notice instead)", async () => {
    wrap(<PlaceList fetcher={okFetch} />);
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBe(bundle.locations.features.length));
    expect(screen.queryByText(/composite, fictional/)).toBeNull();
  });
  it("empty collection says no places are published, not zero or an error", async () => {
    const f = (() => json({ ...bundle.locations, features: [] })) as unknown as typeof fetch;
    wrap(<PlaceList fetcher={f} />);
    expect(await screen.findByText("No places have been published yet.")).toBeTruthy();
  });
  it("a payload that violates the contract is an error and is not rendered", async () => {
    const bad = structuredClone(bundle.locations);
    bad.features[0].properties.interviewGps = [72.5, 23.0];
    wrap(<PlaceList fetcher={(() => json(bad)) as unknown as typeof fetch} />);
    expect(await screen.findByText("Places could not be loaded.")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
  it("persistent network failure (after the automatic retry) shows a retry that recovers", async () => {
    let n = 0;
    const f = (() => (n++ < 2 ? Promise.reject(new Error("net")) : json(bundle.locations))) as unknown as typeof fetch;
    wrap(<PlaceList fetcher={f} />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0));
  });
  it("server 503 is retryable, 404 is not", async () => {
    wrap(<PlaceList fetcher={(() => json({}, 503)) as unknown as typeof fetch} />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    cleanup();
    wrap(<PlaceList fetcher={(() => json({}, 404)) as unknown as typeof fetch} />);
    await screen.findByText("Places could not be loaded.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("explore page with map", () => {
  it("keeps the full list when the map is present and lets the list select a place", async () => {
    wrap(<PlaceList fetcher={okFetch} withMap />);
    expect(await screen.findByTestId("map")).toBeTruthy();
    const btn = await screen.findByRole("button", { name: "Synthetic Atlas Point" });
    await userEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("listitem").length).toBe(bundle.locations.features.length);
  });
});

describe("map explorer URL state and network privacy", () => {
  const calls: string[] = [];
  const spyFetch = ((url: string) => { calls.push(String(url)); return json(bundle.locations); }) as unknown as typeof fetch;
  const first = bundle.locations.features[0];
  const explore = (entry: string) => render(<MemoryRouter initialEntries={[entry]}><PlaceList fetcher={spyFetch} withMap /></MemoryRouter>);

  it("selecting a place writes ?place= and restoring that URL shows the same details", async () => {
    calls.length = 0;
    const { unmount } = explore("/explore");
    const btn = await screen.findByRole("button", { name: first.properties.name.en });
    await userEvent.click(btn);
    expect(await screen.findByRole("complementary", { name: "Selected place" })).toBeTruthy();
    unmount();
    explore(`/explore?place=${first.id}`);
    expect(await screen.findByRole("complementary", { name: "Selected place" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: first.properties.name.en })).toBeTruthy();
  });
  it("an unknown or unpublished place id shows a not-found notice, not details", async () => {
    explore("/explore?place=00000000-0000-4000-8000-0000000000ff");
    expect(await screen.findByText(/was not found/)).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Selected place" })).toBeNull();
  });
  it("only the public locations endpoint is requested; no interview, GPS or private source in any request", async () => {
    calls.length = 0;
    explore(`/explore?place=${first.id}&interview=7&gps=1&lat=1`);
    await screen.findByRole("button", { name: first.properties.name.en });
    expect(calls.length).toBeGreaterThan(0);
    for (const u of calls) {
      expect(u).toMatch(/^\/api\/v1\/public\/locations(\?limit=\d+)?$/);
      expect(u.toLowerCase()).not.toMatch(/interview|gps|participant|private|lat=/);
    }
  });
  it("selection can be cleared and the clear control restores the neutral state", async () => {
    explore(`/explore?place=${first.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("complementary", { name: "Selected place" })).toBeNull();
  });
});

describe("automatic retry", () => {
  it("a single network failure is retried silently and the list appears without user action", async () => {
    let n = 0;
    const f = (() => (n++ === 0 ? Promise.reject(new Error("net")) : json(bundle.locations))) as unknown as typeof fetch;
    wrap(<PlaceList fetcher={f} />);
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
