import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { PanoramaPage } from "./PanoramaPage.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const res = (b: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(b), { status: s }));
const mk = (media: unknown | number, log: string[] = []) => ((url: string) => {
  log.push(url);
  if (/\/locations\?/.test(url)) return res(bundle.locations);
  if (/\/media\//.test(url)) return typeof media === "number" ? res({}, media) : res(media);
  return res({}, 404);
}) as unknown as typeof fetch;
const show = (slug: string, f: typeof fetch) => render(<MemoryRouter initialEntries={[`/places/${slug}/panorama`]}><Routes><Route path="/places/:slug/panorama" element={<PanoramaPage fetcher={f} />} /></Routes></MemoryRouter>);
afterEach(cleanup);

describe("panorama page", () => {
  it("shows the still photograph, date and credit, and an on-demand 360 button, when a panorama is published", async () => {
    const { container } = show("synthetic-point", mk(bundle.media));
    expect(await screen.findByRole("heading", { level: 1, name: "360° view: Synthetic Atlas Point" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore in 360°" })).toBeTruthy();
    expect(container.textContent).toContain("2026-01-01 (exact day)");
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("a place without a panorama says so plainly, promises no coverage, shows ordinary photographs and links back", async () => {
    show("synthetic-point", mk({ ...bundle.media, format: "image", width: 40, height: 30 }));
    expect(await screen.findByRole("heading", { name: "No 360° view for this place" })).toBeTruthy();
    expect(document.body.textContent).toMatch(/none is promised/);
    expect(screen.queryByRole("button", { name: "Explore in 360°" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the place page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open photograph/ })).toBeTruthy();
  });
  it("media that cannot be loaded gives the same honest empty state, not an error page", async () => {
    show("synthetic-point", mk(404));
    expect(await screen.findByRole("heading", { name: "No 360° view for this place" })).toBeTruthy();
  });
  it("an unpublished place shows not-found and requests no media", async () => {
    const log: string[] = [];
    show("not-published", mk(bundle.media, log));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(log.some((u) => /media/.test(u))).toBe(false);
  });
});
