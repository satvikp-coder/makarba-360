import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { LANDMARKS, LandmarkCard } from "./landmarks.js";
vi.mock("./map/MapView.js", () => ({ MapView: () => <div data-testid="map" /> }));

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
afterEach(cleanup);
const WEB = process.cwd();   // vitest runs from apps/web

describe("one calm, honest disclosure of the prototype dataset", () => {
  it("every page footer carries the copyright and links to 'About the data', and nothing else", () => {
    for (const path of ["/", "/explore", "/voices", "/insights", "/places/x", "/research/sources"]) {
      at(path);
      const footer = screen.getByRole("contentinfo");
      expect(footer.textContent, path).toBe("© 2026 Varun Karthic and Satvik PatelAbout the data");
      expect(footer.textContent, path).not.toMatch(/demo|example|prototype|fictional/i);
      expect(within(footer).getByRole("link", { name: "About the data" }).getAttribute("href")).toBe("/research/methodology#prototype-data");
      cleanup();
    }
  });
  it("no banner, badge or per-item labels about the dataset anywhere in the page chrome", () => {
    at("/");
    expect(document.querySelector(".demo-badge, .badge")).toBeNull();
    expect(document.querySelector("header")!.textContent).not.toMatch(/demo|example|prototype/i);
    expect(screen.getByRole("main").textContent).not.toMatch(/ILLUSTRATIVE DEMO|awaiting real data/i);
  });
  it("the methodology page explains what is example, what is sourced and the privacy rules", async () => {
    at("/research/methodology#prototype-data");
    const h = await screen.findByRole("heading", { level: 2, name: "About the data" });
    const s = h.closest("section")!;
    expect(s.textContent).toMatch(/composite, fictional examples/i);
    expect(s.textContent).toMatch(/not survey results/);
    expect(s.textContent).toMatch(/Sourced facts/);
    expect(s.textContent).toMatch(/exact interview locations are never published/);
    expect(s.textContent).toMatch(/public cannot submit/);
  });
});

describe("sourced landmark notes", () => {
  it("every fact points at a listed source with a retrieval date, and every note says why it matters", () => {
    for (const l of LANDMARKS) {
      expect(l.sources.length, l.id).toBeGreaterThan(0);
      for (const f of l.facts) expect(l.sources[f.source], `${l.id}: ${f.text}`).toBeDefined();
      for (const s of l.sources) { expect(s.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//); expect(s.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
      expect(l.why.length).toBeGreaterThan(20);
    }
  });
  it("a card shows its facts, a Sources line with links, and a bundled, credited photo with alt text", () => {
    render(<MemoryRouter><LandmarkCard l={LANDMARKS[0]!} /></MemoryRouter>);
    const card = screen.getByRole("article", { name: "Sarkhej Roza" });
    expect(card.textContent).toMatch(/1445/);
    expect(card.textContent).toMatch(/Why it matters/);
    expect(within(card).getByRole("link", { name: "Wikipedia: Sarkhej Roza" }).getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Sarkhej_Roza");
    const img = within(card).getByRole("img");
    expect(img.getAttribute("src")).toBe("/images/landmarks/sarkhej-roza.jpg");
    expect(img.getAttribute("alt")!.length).toBeGreaterThan(30);
    expect(card.textContent).toMatch(/Photo: Museeb fakih, Public domain, via Wikimedia Commons; resized and recompressed\./);
    expect(within(card).getByRole("link", { name: "Wikimedia Commons" }).getAttribute("href")).toBe("https://commons.wikimedia.org/wiki/File:Sarkhej.JPG");
  });
  it("a card without a licensed photo says its illustration is a drawing", () => {
    const l = LANDMARKS.find((x) => !x.photos?.length)!;
    render(<MemoryRouter><LandmarkCard l={l} /></MemoryRouter>);
    const card = screen.getByRole("article", { name: l.title });
    expect(card.textContent).toMatch(/original drawing, not a photograph/);
    expect(card.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
  it("every photo is local (offline), from Wikimedia Commons, openly licensed, credited and listed in media-credits.md", () => {
    const credits = readFileSync(resolve(WEB, "../../docs/project/media-credits.md"), "utf8");
    const photos = LANDMARKS.flatMap((l) => l.photos ?? []);
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.length).toBeLessThanOrEqual(6);
    for (const p of photos) {
      expect(p.src, p.src).toMatch(/^\/images\/landmarks\/[a-z0-9-]+\.jpg$/);
      expect(p.commonsUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.licence).toMatch(/^(Public domain|No known copyright restrictions|CC0|CC BY 4\.0|CC BY-SA [34]\.0)/);
      if (/^CC/.test(p.licence)) expect(p.licenceUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(p.alt.length).toBeGreaterThan(30);
      expect(credits, p.src).toContain(p.src.split("/").pop()!);
      expect(credits, p.commonsUrl).toContain(p.commonsUrl);
      const file = resolve(WEB, `../../data${p.src}`);
      expect(existsSync(file), p.src).toBe(true);
      expect(statSync(file).size, p.src).toBeLessThanOrEqual(150 * 1024);
    }
  });
});

describe("place photographs", () => {
  it("are bundled, from Wikimedia Commons, openly licensed, at most 150 KB, credited, and representative ones say so", async () => {
    const { photoFor } = await import("./placePhotos.js");
    const credits = readFileSync(resolve(WEB, "../../docs/project/media-credits.md"), "utf8");
    const slugs = ["junction-fruit-carts", "mosque-lane-tea-corner", "village-bus-stand", "highway-auto-stand", "canal-bank-walk", "old-cotton-mill-site", "factory-road-vending-stretch", "weekend-mela-ground", "lake-edge-steps", "sarkhej-roza-area", "crowdfunded-snack-stall", "visitor-drop-off"];
    for (const s of slugs) {
      const p = photoFor(s)!;
      expect(p, s).toBeDefined();
      expect(p.src).toMatch(/^\/images\/(places|landmarks)\/[a-z0-9-]+\.jpg$/);
      expect(p.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.licence).toMatch(/^(Public domain|CC BY-SA [34]\.0|CC BY 4\.0|CC0)/);
      expect(p.alt.length).toBeGreaterThan(30);
      const file = resolve(WEB, `../../data${p.src}`);
      expect(existsSync(file), p.src).toBe(true);
      expect(statSync(file).size, p.src).toBeLessThanOrEqual(150 * 1024);
      expect(credits, p.src).toContain(p.src.split("/").pop()!);
    }
  });
});
