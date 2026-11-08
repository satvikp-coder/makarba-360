import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./map/MapView.js", () => ({ MapView: () => null }));
import { ThenNowPage } from "./ThenNowPage.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const res = (b: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(b), { status: s }));
const mk = (h: { history?: unknown | number } = {}, log: string[] = []) => ((url: string) => {
  log.push(url);
  if (/\/locations\?/.test(url)) return res(bundle.locations);
  if (/\/history$/.test(url)) return typeof h.history === "number" ? res({}, h.history) : res(h.history ?? bundle.history);
  if (/\/media\//.test(url)) return res(bundle.media);
  return res({}, 404);
}) as unknown as typeof fetch;
const page = (slug: string, f: typeof fetch) => render(<MemoryRouter initialEntries={[`/places/${slug}/then-and-now`]}><Routes><Route path="/places/:slug/then-and-now" element={<ThenNowPage fetcher={f} />} /></Routes></MemoryRouter>);
afterEach(cleanup);

describe("Then & Now page (P06)", () => {
  it("shows the verified comparison with dates and sources", async () => {
    const { container } = page("synthetic-point", mk());
    expect(await screen.findByRole("slider")).toBeTruthy();
    expect(container.textContent).toContain("2021 (year)");
    expect(container.textContent).toContain("Invented test citation");
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("a withdrawn pair (history no longer lists it) disappears on the next load", async () => {
    page("synthetic-point", mk({ history: { ...bundle.history, comparisonPairs: [] } }));
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.queryByRole("slider")).toBeNull());
    expect(document.body.textContent).toMatch(/disappears from this page the next time it loads/);
  });
  it("history that cannot be loaded says so; an unknown place is not found and requests no history", async () => {
    page("synthetic-point", mk({ history: 500 }));
    expect(await screen.findByText(/History could not be loaded/)).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    cleanup();
    const log: string[] = [];
    page("not-published", mk({}, log));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(log.some((u) => /history/.test(u))).toBe(false);
  });
});
