import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./map/MapView.js", () => ({ MapView: () => null }));
import { PlaceProfile } from "./Profile.js";
import { PlaceList } from "./App.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const HOSTILE = `<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>`;
const locations = JSON.parse(JSON.stringify(bundle.locations));
locations.features[0].properties.name = { en: HOSTILE };
const history = JSON.parse(JSON.stringify(bundle.history));
history.events[0].text = HOSTILE; history.sources[0].citation = HOSTILE;
const media = { ...bundle.media, alt: HOSTILE, credit: HOSTILE };
const res = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
const f = ((u: string) => (/\/locations\?/.test(u) ? res(locations) : /\/history$/.test(u) ? res(history) : /\/media\//.test(u) ? res(media) : res({}))) as unknown as typeof fetch;
afterEach(cleanup);

describe("stored text is always rendered as text", () => {
  it("AC-14 hostile place names, history text, citations and media captions are shown literally and never become elements or run", async () => {
    const { container } = render(<MemoryRouter initialEntries={["/places/synthetic-point"]}><Routes><Route path="/places/:slug" element={<PlaceProfile fetcher={f} />} /></Routes></MemoryRouter>);
    await screen.findByRole("heading", { level: 1 });
    await screen.findAllByText(/onerror/, { exact: false });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelectorAll("[onerror],[onload],[onclick]")).toHaveLength(0);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
  it("AC-14 the explorer list renders a hostile name as text too", async () => {
    const { container } = render(<MemoryRouter><PlaceList fetcher={f} /></MemoryRouter>);
    await screen.findByText(/onerror/, { exact: false });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
