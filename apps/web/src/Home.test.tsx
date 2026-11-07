import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Home, HeroMedia } from "./Home.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const f = (b: unknown, s = 200) => (() => json(b, s)) as unknown as typeof fetch;
const show = (fetcher: typeof fetch, hero?: Parameters<typeof Home>[0]["hero"]) => render(<MemoryRouter><Home fetcher={fetcher} hero={hero} /></MemoryRouter>);
afterEach(cleanup);

describe("home page", () => {
  it("has identity, one h1, an Explore action, methodology link and the intro sections", async () => {
    show(f(bundle.locations));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Explore the map" }).getAttribute("href")).toBe("/explore");
    expect(screen.getByRole("link", { name: "Read the research methodology" }).getAttribute("href")).toBe("/research/methodology");
    for (const h of ["About this atlas", "Featured places", "Then & Now", "Community Voices"]) expect(screen.getByRole("heading", { level: 2, name: h })).toBeTruthy();
  });
  it("featured places come from the contract and link to the map selection; fixtures are labelled synthetic", async () => {
    show(f(bundle.locations));
    const first = bundle.locations.features[0];
    const link = await screen.findByRole("link", { name: first.properties.name.en });
    expect(link.getAttribute("href")).toBe(`/explore?place=${first.id}`);
    expect(screen.getByText(/Demonstration data/)).toBeTruthy();
  });
  it("shows no fabricated findings, counts or percentages", async () => {
    const { container } = show(f(bundle.locations));
    await screen.findAllByRole("listitem");
    expect(container.textContent).not.toMatch(/\d+\s*(%|responses|respondents|interviews|residents)/i);
  });
  it("empty and error states are explicit, not blank", async () => {
    show(f({ ...bundle.locations, features: [] }));
    expect(await screen.findByText("No places have been published yet.")).toBeTruthy();
    cleanup();
    show(f({}, 503));
    expect(await screen.findByText("Places could not be loaded.")).toBeTruthy();
  });
  it("without approved hero media it shows the honest typographic fallback and no image", () => {
    const { container } = show(f(bundle.locations));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /No approved photograph is available/ })).toBeTruthy();
  });
  it("approved hero media renders with date, credit and licence; incomplete or unsafe media falls back", () => {
    const ok = { src: "/media/synthetic-hero.jpg", alt: "Synthetic test image", date: "2026-01-01", credit: "Synthetic credit", licence: "synthetic-test-only" };
    const a = render(<HeroMedia media={ok} />);
    expect(a.container.querySelector("img")).not.toBeNull();
    expect(a.container.textContent).toContain("Synthetic credit");
    a.unmount();
    for (const bad of [{ ...ok, credit: "" }, { ...ok, licence: "" }, { ...ok, date: "" }, { ...ok, src: "javascript:alert(1)" }, { ...ok, src: "http://insecure.example/x.jpg" }]) {
      const r = render(<HeroMedia media={bad} />);
      expect(r.container.querySelector("img")).toBeNull();
      r.unmount();
    }
  });
  it("an image that fails to load switches to the fallback", () => {
    const ok = { src: "/media/missing.jpg", alt: "x", date: "2026-01-01", credit: "c", licence: "l" };
    const { container } = render(<HeroMedia media={ok} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /No approved photograph/ })).toBeTruthy();
  });
  it("passes automated accessibility checks", async () => {
    const { container } = show(f(bundle.locations));
    await screen.findAllByRole("listitem");
    const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
