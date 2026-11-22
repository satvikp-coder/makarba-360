import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importCommunity } from "./communityModel.js";
import { PeopleAndPlace } from "./PeopleAndPlace.js";
import { AS_OF, group, publishable } from "./__fixtures__/communitySynthetic.js";

afterEach(cleanup);
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const f = (body: unknown, status = 200) => vi.fn(async () => reply(body, status)) as unknown as typeof fetch;
const published = () => importCommunity(publishable(), { asOf: AS_OF }).doc;
const NONE = /No permission-cleared recollections of change over time have been published yet/;

describe("PeopleAndPlace", () => {
  it("shows a loading status first", () => {
    render(<PeopleAndPlace fetcher={vi.fn(() => new Promise(() => {})) as unknown as typeof fetch} />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
  });
  it("with no approved entries keeps the accurate empty message and lists what is being collected", async () => {
    render(<PeopleAndPlace fetcher={f({ version: 1, status: "no-approved-material", updated: null, minCellSize: 5, entries: [] })} />);
    expect((await screen.findByRole("note")).textContent).toMatch(NONE);
    expect(screen.getByText("What is being collected")).toBeTruthy();
    expect(screen.getByText("Costs of development")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("treats a missing file (404) the same as nothing published", async () => {
    render(<PeopleAndPlace fetcher={f({}, 404)} />);
    expect((await screen.findByRole("note")).textContent).toMatch(NONE);
  });
  it("shows an alert and a working retry on error, and never shows content from an invalid file", async () => {
    const bad = published(); (bad.entries[0] as { text: string }).text = "Email someone@example.org about it.";
    const fetcher = vi.fn().mockResolvedValueOnce(reply(bad)).mockResolvedValue(reply(published())) as unknown as typeof fetch;
    render(<PeopleAndPlace fetcher={fetcher} />);
    expect((await screen.findByRole("alert")).textContent).not.toMatch(/someone@example/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(5));
  });
  it("renders accessible cards with theme, period, stance, provenance and consent scope", async () => {
    render(<PeopleAndPlace fetcher={f(published())} />);
    const card = (await screen.findAllByText(/Synthetic test recollection 1 about travel/))[0]!.closest("li")!;
    const c = within(card);
    expect(c.getByText("Transport and access")).toBeTruthy();
    expect(c.getByText("Before 2005, after 2020")).toBeTruthy();
    expect(c.getByText("Synthetic Test Ward")).toBeTruthy();
    expect(c.getByText(/Interview, 2026-03/)).toBeTruthy();
    expect(c.getByText(/Shared with permission/)).toBeTruthy();
    expect(c.getByText("Researcher paraphrase")).toBeTruthy();
  });
  it("filters by theme with aria-pressed buttons and announces the count", async () => {
    render(<PeopleAndPlace fetcher={f(published())} />);
    const g = await screen.findByRole("group", { name: /Filter recollections by theme/ });
    const all = within(g).getByRole("button", { name: "All" });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(/15 recollections shown/);
    const costs = within(g).getByRole("button", { name: "Costs of development" });
    fireEvent.click(costs);
    expect(costs.getAttribute("aria-pressed")).toBe("true"); expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("status").textContent).toMatch(/5 recollections shown/);
    expect(screen.queryByText(/about travel/)).toBeNull();
    expect(within(g).queryByRole("button", { name: "Livelihoods and work" })).toBeNull();
  });
  it("lists theme counts, hides unpublished themes' counts and flags a one-sided benefits/costs picture", async () => {
    const one = importCommunity([...group("development-benefits"), ...group("transport-access")], { asOf: AS_OF }).doc;
    render(<PeopleAndPlace fetcher={f(one)} />);
    expect(await screen.findByText(/Benefits of development: 5 published/)).toBeTruthy();
    expect(screen.getByText(/Livelihoods and work: not shown \(fewer than 5 separate contributors\)/)).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Only benefits of development are published.*costs side is not yet covered/);
  });
  it("shows an explicit label for a missing period, stance and locality instead of a guess", async () => {
    const list = group("livelihoods").map((e) => ({ ...e, period: { missing: "unsure" as const }, perspective: { missing: "skipped" as const }, provenance: { ...e.provenance, locality: { missing: "not_asked" as const } } }));
    render(<PeopleAndPlace fetcher={f(importCommunity(list, { asOf: AS_OF }).doc)} />);
    expect((await screen.findAllByText("Years not stated")).length).toBe(5);
    expect(screen.getAllByText("Stance not stated").length).toBe(5);
    expect(screen.getAllByText("Locality not recorded").length).toBe(5);
  });
  it("has no axe violations (empty and populated)", async () => {
    const opts = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
    const a = render(<PeopleAndPlace fetcher={f({ version: 1, status: "no-approved-material", updated: null, minCellSize: 5, entries: [] })} />);
    await screen.findByRole("note");
    expect((await axe.run(a.container, opts)).violations).toEqual([]);
    a.unmount();
    const b = render(<PeopleAndPlace fetcher={f(published())} />);
    await screen.findByRole("group", { name: /Filter recollections/ });
    expect((await axe.run(b.container, opts)).violations).toEqual([]);
  });
});
