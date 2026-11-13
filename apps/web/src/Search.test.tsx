import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicFeature } from "./api.js";
import { cleanQuery, localSource, type SearchSource } from "./searchSource.js";

vi.mock("./map/MapView.js", () => ({ MapView: ({ features, selectedId }: { features: PublicFeature[]; selectedId: string | null }) => <div data-testid="map" data-count={features.length} data-selected={selectedId ?? ""} /> }));
import { PlaceList } from "./App.js";
import { WithMap } from "./testMap.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const ID = { point: bundle.locations.features[0].id as string, route: bundle.locations.features[1].id as string, area: bundle.locations.features[2].id as string };
// Give the synthetic point a Gujarati and an accented name; keep the contract shape (name may be a language map).
const locations = JSON.parse(JSON.stringify(bundle.locations));
locations.features[0].properties.name = { en: "Synthetic Atlas Point", gu: "કૃત્રિમ બિંદુ" };
locations.features[1].properties.name = { en: "Café Étoile Route" };
const fetcher = (() => Promise.resolve(new Response(JSON.stringify(locations), { status: 200 }))) as unknown as typeof fetch;
const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname + l.search}</output>; };
const show = (url = "/explore", makeSource?: (f: PublicFeature[]) => SearchSource) =>
  render(<MemoryRouter initialEntries={[url]}><WithMap><PlaceList withMap fetcher={fetcher} {...(makeSource ? { makeSource } : {})} /></WithMap><Where /></MemoryRouter>);
afterEach(cleanup);
const search = async (u: ReturnType<typeof userEvent.setup>, text: string) => {
  const box = await screen.findByRole("searchbox", { name: "Search places" });
  await u.clear(box); if (text) await u.type(box, text);
  await u.click(screen.getByRole("button", { name: "Search" }));
};

describe("cleanQuery", () => {
  it("trims, collapses spaces, caps length and treats empty as no search", () => {
    expect(cleanQuery("  lake   shore ")).toBe("lake shore");
    expect(cleanQuery(null)).toBe("");
    expect(cleanQuery("x".repeat(500))).toHaveLength(100);
  });
});

describe("place search", () => {
  it("finds a place by its English name and records the query in the URL", async () => {
    const u = userEvent.setup();
    show();
    await search(u, "atlas");
    expect(await screen.findByText("1 place matches “atlas”.")).toBeTruthy();
    expect(screen.getByTestId("url").textContent).toContain("q=atlas");
    expect(screen.getByTestId("map").dataset.count).toBe("1");
    expect(screen.queryByRole("button", { name: "Café Étoile Route" })).toBeNull();
  });
  it("finds a place by its Gujarati name, and ignores accents and capitals", async () => {
    const u = userEvent.setup();
    show();
    await search(u, "કૃત્રિમ");
    expect(await screen.findByText(/1 place matches/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Synthetic Atlas Point" })).toBeTruthy();
    await search(u, "CAFE etoile");
    expect(await screen.findByText(/1 place matches “CAFE etoile”/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Café Étoile Route" })).toBeTruthy();
  });
  it("no match says so plainly, keeps the map and Clear search, and clearing restores every place", async () => {
    const u = userEvent.setup();
    show();
    await search(u, "zzzz");
    expect(await screen.findByText("No places match “zzzz”.")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.count).toBe("0");
    await u.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(screen.getByTestId("map").dataset.count).toBe("3"));
    expect(screen.getByTestId("url").textContent).toBe("/explore");
  });
  it("selection and search restore together from a shared link", async () => {
    show(`/explore?q=atlas&place=${ID.point}`);
    expect(await screen.findByText("1 place matches “atlas”.")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Selected place" })).toBeTruthy();
    expect(screen.getByTestId("map").dataset.selected).toBe(ID.point);
  });
  it("combines with category filters (AND)", async () => {
    const u = userEvent.setup();
    show();
    await u.click(await screen.findByRole("button", { name: "Transport" }));
    await search(u, "atlas");
    expect(await screen.findByText("No places match “atlas”.")).toBeTruthy();
  });
  it("a hostile query is only text: no markup is rendered and nothing is requested", async () => {
    const u = userEvent.setup();
    const { container } = show();
    await search(u, "<img src=x onerror=alert(1)>");
    await screen.findByText(/No places match/);
    expect(container.querySelector("img[src='x']")).toBeNull();
  });
  it("passes automated accessibility checks", async () => {
    const { container } = show("/explore?q=atlas");
    await screen.findByText(/1 place matches/);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("stale responses and private data", () => {
  it("a slow answer to an older query cannot overwrite the answer to a newer one", async () => {
    const u = userEvent.setup();
    const pending: Record<string, (ids: string[]) => void> = {};
    const makeSource = (): SearchSource => ({ search: (q) => new Promise<string[]>((res) => { pending[q] = res; }) });
    show("/explore", makeSource);
    await search(u, "atlas");           // first query stays pending
    await search(u, "route");           // newer query
    await waitFor(() => expect(pending["route"]).toBeDefined());
    pending["route"]!([ID.route]);
    expect(await screen.findByText("1 place matches “route”.")).toBeTruthy();
    pending["atlas"]!([ID.point]);      // older answer arrives late
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText("1 place matches “route”.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Café Étoile Route" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Synthetic Atlas Point" })).toBeNull();
  });
  it("while a search is pending the list does not show stale results from the previous query", async () => {
    const u = userEvent.setup();
    const makeSource = (f: PublicFeature[]): SearchSource => (({ search: (q: string, s: AbortSignal) => (q === "slow" ? new Promise<string[]>(() => {}) : localSource(f).search(q, s)) }));
    show("/explore", makeSource);
    await search(u, "atlas");
    await screen.findByText(/1 place matches/);
    await search(u, "slow");
    expect(await screen.findByText("Searching…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Synthetic Atlas Point" })).toBeNull();
  });
  it("ids a source returns that are not published places (for example a private candidate) are ignored", async () => {
    const u = userEvent.setup();
    const makeSource = (): SearchSource => ({ search: async () => ["99999999-9999-4999-8999-999999999999", ID.area] });
    show("/explore", makeSource);
    await search(u, "anything");
    expect(await screen.findByText("1 place matches “anything”.")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.count).toBe("1");
    expect(document.body.textContent).not.toContain("99999999");
  });
  it("a failing source shows a clear message and does not show unfiltered or stale places as results", async () => {
    const u = userEvent.setup();
    const makeSource = (): SearchSource => ({ search: async () => { throw new Error("down"); } });
    show("/explore", makeSource);
    await search(u, "atlas");
    expect(await screen.findByText(/Search could not be completed/)).toBeTruthy();
    expect(screen.getByTestId("map").dataset.count).toBe("0");
    await u.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(screen.getByTestId("map").dataset.count).toBe("3"));
  });
});
