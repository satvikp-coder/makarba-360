import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicFeature } from "./api.js";
import { applyFilters, isActive, parseFilters, toggle, writeFilters } from "./filters.js";

const seen: { ids: string[] }[] = [];
vi.mock("./map/MapView.js", () => ({
  MapView: ({ features }: { features: PublicFeature[] }) => { seen.push({ ids: features.map((f) => String(f.id)) }); return <div data-testid="map" data-count={features.length}>attribution kept</div>; },
}));
import { PlaceList } from "./App.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const okFetch = (() => Promise.resolve(new Response(JSON.stringify(bundle.locations), { status: 200 }))) as unknown as typeof fetch;
const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname + l.search}</output>; };
const show = (url = "/explore") => render(<MemoryRouter initialEntries={[url]}><PlaceList withMap fetcher={okFetch} /><Where /></MemoryRouter>);
afterEach(() => { cleanup(); seen.length = 0; });

const places = [
  { id: "1", slug: "a", name: "A", category: "heritage", mediaIds: [], geometryType: "Point" },
  { id: "2", slug: "b", name: "B", category: "transport", mediaIds: [], geometryType: "MultiLineString" },
  { id: "3", slug: "c", name: "C", category: "community", mediaIds: [], geometryType: "MultiPolygon" },
];
const features = places.map((p) => ({ type: "Feature", id: p.id, geometry: { type: p.geometryType, coordinates: [] }, properties: { slug: p.slug, name: p.name, category: p.category } })) as PublicFeature[];
const cats = ["community", "heritage", "transport"];

describe("filter logic", () => {
  it("no filters keep everything; category and layer filters narrow; both combine with AND", () => {
    expect(applyFilters(places, features, { categories: [], layers: [] }).places).toHaveLength(3);
    expect(applyFilters(places, features, { categories: ["heritage"], layers: [] }).places.map((p) => p.id)).toEqual(["1"]);
    expect(applyFilters(places, features, { categories: [], layers: ["lines", "areas"] }).places.map((p) => p.id)).toEqual(["2", "3"]);
    expect(applyFilters(places, features, { categories: ["heritage"], layers: ["lines"] }).places).toEqual([]);
  });
  it("features follow the same filter as the list so map and list never disagree", () => {
    const r = applyFilters(places, features, { categories: ["transport"], layers: [] });
    expect(r.features.map((f) => String(f.id))).toEqual(r.places.map((p) => p.id));
  });
  it("URL parsing ignores unknown categories and layers instead of emptying the map", () => {
    expect(parseFilters(new URLSearchParams("category=zzz,heritage&layers=nope,points"), cats)).toEqual({ categories: ["heritage"], layers: ["points"] });
    expect(parseFilters(new URLSearchParams("category=zzz"), cats)).toEqual({ categories: [], layers: [] });
  });
  it("round-trips through the URL and removes empty keys; keeps other keys", () => {
    const p = writeFilters(new URLSearchParams("place=x&q=lake"), { categories: ["heritage", "transport"], layers: ["points"] });
    expect(p.toString()).toBe("place=x&q=lake&category=heritage%2Ctransport&layers=points");
    expect(writeFilters(p, { categories: [], layers: [] }).toString()).toBe("place=x&q=lake");
    expect(isActive({ categories: [], layers: [] })).toBe(false);
    expect(toggle(["a"], "a")).toEqual([]);
  });
});

describe("explorer filter controls", () => {
  it("chips are toggle buttons with selected state, keyboard operable, and update list, map and URL", async () => {
    const u = userEvent.setup();
    const { container } = show();
    const chip = await screen.findByRole("button", { name: "Heritage" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    chip.focus();
    await u.keyboard("{Enter}");
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("url").textContent).toContain("category=heritage");
    expect(screen.getByTestId("map").dataset.count).toBe("1");
    expect(screen.getByText("Showing 1 of 3 places.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Synthetic Atlas Route" })).toBeNull();
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("layer checkboxes filter by geometry kind", async () => {
    const u = userEvent.setup();
    show();
    await u.click(await screen.findByRole("checkbox", { name: "Points" }));
    expect(screen.getByTestId("url").textContent).toContain("layers=points");
    expect(screen.getByTestId("map").dataset.count).toBe("1");
  });
  it("empty result keeps reset, list area, map attribution and says so; reset restores everything", async () => {
    const u = userEvent.setup();
    show();
    await u.click(await screen.findByRole("button", { name: "Heritage" }));
    await u.click(screen.getByRole("checkbox", { name: "Streets and routes" }));
    expect(screen.getByText(/No places match these filters/)).toBeTruthy();
    expect(screen.getByTestId("map").textContent).toBe("attribution kept");
    expect(screen.getByTestId("map").dataset.count).toBe("0");
    await u.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("Showing all 3 places.")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.count).toBe("3");
    expect(screen.getByTestId("url").textContent).toBe("/explore");
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
  });
  it("restores filters from a shared link and ignores a stale category", async () => {
    show("/explore?category=transport");
    expect((await screen.findByRole("button", { name: "Transport" })).getAttribute("aria-pressed")).toBe("true");
    cleanup();
    show("/explore?category=gone");
    await screen.findByRole("button", { name: "Transport" });
    expect(screen.getByText("Showing all 3 places.")).toBeTruthy();
  });
  it("selecting a place keeps filters in the URL", async () => {
    const u = userEvent.setup();
    show();
    await u.click(await screen.findByRole("button", { name: "Heritage" }));
    await u.click(within(screen.getByRole("region", { name: "Places and details" })).getByRole("button", { name: "Synthetic Atlas Point" }));
    const url = screen.getByTestId("url").textContent!;
    expect(url).toContain("category=heritage");
    expect(url).toContain("place=");
  });
});
