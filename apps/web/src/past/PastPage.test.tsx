import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PastPage } from "./PastPage.js";
import { EraNav } from "./EraNav.js";
import { PastMap } from "./PastMap.js";
import { usableEvents, chartCheck, validVisual, type PastDoc } from "./pastModel.js";

const dataDir = resolve(process.cwd(), "../../data");
const read = (p: string) => JSON.parse(readFileSync(resolve(dataDir, p), "utf8"));
const doc: PastDoc = read("content/past.json");
const roads = read("geo/osm-roads.json");
const landmarks = read("geo/osm-landmarks.json");

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const fetcher = (routes: Record<string, unknown>) => vi.fn(async (u: string) => {
  const hit = Object.keys(routes).find((k) => u.endsWith(k));
  return hit ? respond(routes[hit]) : respond({}, 404);
}) as unknown as typeof fetch;
const full = fetcher({ "/content/past.json": doc, "/geo/osm-roads.json": roads, "/geo/osm-landmarks.json": landmarks });
const page = (f = full) => render(<MemoryRouter><PastPage fetcher={f} /></MemoryRouter>);
afterEach(cleanup);

describe("the published past.json (data integrity)", () => {
  it("every event is valid: sourced, dated, with an uncertainty note", () => expect(usableEvents(doc).length).toBe(doc.events.length));
  it("keeps plans apart from built things: no proposal or approval is marked implemented", () => {
    const planned = doc.events.filter((e) => /approv|foundation|plan/i.test(e.title) && e.theme !== "heritage" && e.id !== "infra-2009-janmarg");
    expect(planned.length).toBeGreaterThan(0);
    for (const e of planned) expect(["proposed", "sanctioned"]).toContain(e.status);
  });
  it("every second-source listing is sourced and no scheme copies outside geometry", () => {
    for (const s of doc.tpSchemes) for (const a of s.alsoListed ?? []) expect(a.source.url).toMatch(/^https:\/\//);
    expect(JSON.stringify(doc)).not.toMatch(/coordinates|"geometry":\s*\{/);
  });
  it("draws no scheme boundary: none is held", () => expect(doc.tpSchemes.every((s) => s.geometry === "unavailable")).toBe(true));
  it("does not chart single-year population counts", () => expect(doc.comparisons.every((c) => !chartCheck(c).ok)).toBe(true));
  it("only uses images with alt text, a licence and a source page", () => expect(doc.visualRecord.every(validVisual)).toBe(true));
  it("invents no residents: there is no testimony field in the dataset", () => expect(JSON.stringify(doc)).not.toMatch(/"quote"|"respondent"|"interview"/i));
});

describe("Past page", () => {
  it("shows a loading state, then the headline and the era navigation", async () => {
    page();
    expect(screen.getByRole("status").textContent).toMatch(/Loading the historical record/);
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    const nav = screen.getAllByRole("navigation", { name: /Past, present and future/ })[0]!;
    expect(within(nav).getByRole("link", { name: /Past/ }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: /Present/ }).getAttribute("href")).toContain("/explore");
    expect(within(nav).getByRole("link", { name: /Future/ }).getAttribute("href")).toBe("/forecasts");
  });

  it("timeline slider filters records by year and says how many are shown", async () => {
    page();
    const slider = await screen.findByRole("slider");
    const total = usableEvents(doc).length;
    await waitFor(() => expect(screen.getByText(new RegExp(`${total} documented records up to 2026`))).toBeTruthy());
    fireEvent.change(slider, { target: { value: "1500" } });
    expect(screen.getByText(/3 documented records up to 1500/)).toBeTruthy();
    expect((slider as HTMLInputElement).min).toBe("1445"); // starts at the first documented record, never earlier
    fireEvent.click(screen.getByRole("button", { name: "Roads & infrastructure" }));
    expect(screen.getByText(/No sourced record in this theme has started by 1500/)).toBeTruthy();
  });

  it("filters by theme with pressed-state buttons", async () => {
    page();
    await screen.findByRole("slider");
    fireEvent.click(screen.getByRole("button", { name: "Roads & infrastructure" }));
    expect(screen.getByRole("button", { name: "Roads & infrastructure" }).getAttribute("aria-pressed")).toBe("true");
    const n = doc.events.filter((e) => e.theme === "infrastructure").length;
    expect(screen.getByText(new RegExp(`${n} documented records up to 2026`))).toBeTruthy();
  });

  it("labels a proposal as a proposal, with source and uncertainty", async () => {
    page();
    await screen.findByRole("slider");
    const card = screen.getAllByRole("heading", { name: /Six-laning of the S.G. Highway is approved/ })[0]!.closest("li")!;
    expect(within(card).getByText("Proposed (not built)")).toBeTruthy();
    expect(within(card).getByRole("link", { name: /DeshGujarat/ }).getAttribute("href")).toMatch(/^https:/);
    expect(card.textContent).toMatch(/Uncertainty:/);
  });

  it("shows the TP scheme record and says plainly that no boundary is drawn", async () => {
    page();
    await screen.findByRole("slider");
    const select = screen.getByLabelText("Scheme") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "tp-84c" } });
    expect(screen.getByText(/Refused by Government/)).toBeTruthy();
    expect(screen.getAllByText(/Not drawn: no reviewed scheme map/).length).toBe(1);
  });

  it("shows a conflicting area from a second source side by side, never merged", async () => {
    page();
    await screen.findByRole("slider");
    fireEvent.change(screen.getByLabelText("Scheme"), { target: { value: "tp-84b" } });
    const note = screen.getByText(/Also listed elsewhere:/).closest("div")!;
    expect(note.textContent).toMatch(/51\.64 ha/);
    expect(note.textContent).toMatch(/differs from the 41\.8 ha above/);
    expect(within(note).getByRole("link", { name: /Town Plan Map/ }).getAttribute("href")).toBe("https://townplanmap.com/home");
  });

  it("refuses to chart one measurement and explains why", async () => {
    page();
    await screen.findByRole("slider");
    expect(screen.getAllByText(/Only one dated measurement exists/).length).toBe(doc.comparisons.length);
    expect(screen.queryByRole("img", { name: /Population of Makarba/ })).toBeNull();
  });

  it("publishes no invented resident voices and points to consented present-day pages", async () => {
    page();
    await screen.findByRole("slider");
    expect(screen.getByText(/No permission-cleared recollections/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Community Voices" }).getAttribute("href")).toBe("/voices");
  });

  it("separates hypotheses from findings and lists what is missing", async () => {
    page();
    await screen.findByRole("slider");
    expect(screen.getByRole("heading", { name: /Questions to test, not findings/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /What is still missing/ })).toBeTruthy();
    expect(screen.getByText(/Official ASI\/NMA record/)).toBeTruthy();
  });

  it("describes the dated images as a record, not a before/after pair", async () => {
    page();
    await screen.findByRole("slider");
    expect(screen.getAllByRole("img", { name: /Sepia albumen print/ }).length).toBe(1);
    expect(screen.getByText(/not a before\/after pair/)).toBeTruthy();
  });

  it("shows an empty state when the record is not published, and an error with retry", async () => {
    const { unmount } = page(fetcher({}));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/has not been published yet/));
    unmount();
    const bad = vi.fn(async () => respond({}, 500)) as unknown as typeof fetch;
    page(bad);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not be loaded/);
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect((bad as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2));
  });

  it("hides a record that lacks a source instead of showing it", async () => {
    const broken: PastDoc = { ...doc, events: [...doc.events, { ...doc.events[0]!, id: "x", title: "Unsourced claim", source: { ...doc.events[0]!.source, url: "" } }] };
    page(fetcher({ "/content/past.json": broken, "/geo/osm-roads.json": roads, "/geo/osm-landmarks.json": landmarks }));
    await screen.findByRole("slider");
    expect(screen.queryByText("Unsourced claim")).toBeNull();
    expect(screen.getByText(/1 record was hidden because the source, date or uncertainty note was incomplete/)).toBeTruthy();
  });
});

describe("PastMap", () => {
  it("draws only today's mapped features and toggles layers from the keyboard-reachable checkboxes", async () => {
    const { container } = render(<PastMap fetcher={fetcher({ "/geo/osm-roads.json": roads, "/geo/osm-landmarks.json": landmarks })} />);
    expect(await screen.findByRole("img", { name: /mapped today/ })).toBeTruthy();
    expect(container.querySelectorAll("path").length).toBe(5);
    fireEvent.click(screen.getByRole("checkbox", { name: /Canal near Makarba/ }));
    expect(container.querySelectorAll("path").length).toBe(4);
    expect(screen.getByText(/No historical outline, road line or town-planning boundary is drawn/)).toBeTruthy();
  });
  it("shows an error state when the outlines fail to load", async () => {
    render(<PastMap fetcher={fetcher({})} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be loaded/);
  });
});

describe("EraNav", () => {
  it("marks the current era", () => {
    render(<MemoryRouter><EraNav current="future" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Future/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Past/ }).getAttribute("aria-current")).toBeNull();
  });
});
