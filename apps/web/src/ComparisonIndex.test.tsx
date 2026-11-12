import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonIndex } from "./ComparisonIndex.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
afterEach(cleanup);

describe("comparison directory", () => {
  it("links validated synthetic places to their comparison pages", async () => {
    const fetcher = vi.fn(() => response(bundle.locations)) as unknown as typeof fetch;
    render(<MemoryRouter><ComparisonIndex fetcher={fetcher} /></MemoryRouter>);
    const place = bundle.locations.features[0];
    const link = await screen.findByRole("link", { name: place.properties.name.en });
    expect(link.getAttribute("href")).toBe(`/places/${place.properties.slug}/then-and-now`);
    expect(screen.queryByText(/composite, fictional/)).toBeNull();   // one site-wide notice, not one per page
  });
  it("shows an empty state and refuses invalid payloads", async () => {
    const fetcher = vi.fn(() => response({ ...bundle.locations, features: [] })) as unknown as typeof fetch;
    const view = render(<MemoryRouter><ComparisonIndex fetcher={fetcher} /></MemoryRouter>);
    expect(await screen.findByText("No places have been published yet.")).toBeTruthy();
    view.unmount();
    render(<MemoryRouter><ComparisonIndex fetcher={vi.fn(() => response({ features: [] })) as unknown as typeof fetch} /></MemoryRouter>);
    expect(await screen.findByText("Places could not be loaded.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("retries a temporary failure", async () => {
    let available = false;
    const fetcher = vi.fn(() => available ? response(bundle.locations) : response({}, 503));
    render(<MemoryRouter><ComparisonIndex fetcher={fetcher as unknown as typeof fetch} /></MemoryRouter>);
    const retry = await screen.findByRole("button", { name: "Try again" }, { timeout: 5000 });
    available = true;
    fireEvent.click(retry);
    expect(await screen.findByRole("link", { name: bundle.locations.features[0].properties.name.en })).toBeTruthy();
  });
});
