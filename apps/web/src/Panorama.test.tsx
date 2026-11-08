import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaData } from "./api.js";
import { Panorama, panoramaBlocker } from "./Panorama.js";

afterEach(() => { cleanup(); delete window.pannellum; vi.restoreAllMocks(); });
const pano = (o: Partial<MediaData> = {}): MediaData => ({
  id: "p", url: "https://img.invalid/derivatives/pano.webp", alt: "Synthetic panorama of a test street", credit: "Synthetic credit", licence: "test-only",
  capturedDate: { value: "2026-01-01", precision: "day" }, format: "equirectangular", width: 4096, height: 2048, staticFallbackUrl: "https://img.invalid/derivatives/still.webp", ...o,
});

/** Fake Pannellum with a controllable outcome. */
function fakePannellum(outcome: "load" | "error-webgl" | "error-img") {
  const destroy = vi.fn();
  const handlers: Record<string, (...a: unknown[]) => void> = {};
  const viewer = vi.fn((...args: [HTMLElement, Record<string, unknown>]) => {
    void args;
    queueMicrotask(() => {
      if (outcome === "load") handlers["load"]?.();
      else handlers["error"]?.(outcome === "error-webgl" ? "Your web browser does not support WebGL." : "The panorama image could not be accessed.");
    });
    return { destroy, on: (e: string, cb: (...a: unknown[]) => void) => { handlers[e] = cb; } };
  });
  return { viewer, destroy, install: () => { window.pannellum = { viewer }; } };
}
// jsdom has no WebGL: report a context with a texture limit so the real preflight path runs.
const gl = (max: number | null) => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((t: string) =>
  /webgl/.test(t) && max !== null ? { MAX_TEXTURE_SIZE: 1, getParameter: () => max, getExtension: () => null } : null) as never);

describe("panoramaBlocker (pure)", () => {
  it("explains each reason the interactive view is not offered", () => {
    expect(panoramaBlocker(pano(), 8192)).toBeNull();
    expect(panoramaBlocker(pano(), null)).toMatch(/needs WebGL/);
    expect(panoramaBlocker(pano({ width: 16384 }), 8192)).toMatch(/too large/);
    expect(panoramaBlocker(pano({ format: "image" }), 8192)).toMatch(/not a 360/);
    expect(panoramaBlocker(pano({ url: "https://img.invalid/original/p.jpg" }), 8192)).toMatch(/unavailable/);
    expect(panoramaBlocker(pano({ url: "http://img.invalid/p.webp" }), 8192)).toMatch(/unavailable/);
  });
  it("a texture exactly at the GPU limit is allowed; one pixel over is not", () => {
    expect(panoramaBlocker(pano({ width: 4096 }), 4096)).toBeNull();
    expect(panoramaBlocker(pano({ width: 4097 }), 4096)).not.toBeNull();
  });
});

describe("Panorama component", () => {
  it("initially shows only the static photo with date, credit and licence; the viewer is not loaded", () => {
    const f = fakePannellum("load"); f.install();
    const { container } = render(<Panorama media={pano()} loadViewer={async () => {}} />);
    expect(screen.getByAltText("Synthetic panorama of a test street")).toBeTruthy();
    expect(container.textContent).toContain("2026-01-01 (exact day)");
    expect(container.textContent).toContain("Synthetic credit · test-only");
    expect(f.viewer).not.toHaveBeenCalled();
  });
  it("starts the viewer on request with safe settings, and closing destroys it", async () => {
    gl(8192);
    const u = userEvent.setup();
    const f = fakePannellum("load"); f.install();
    const load = vi.fn(async () => {});
    render(<Panorama media={pano()} loadViewer={load} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close 360° view" })).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
    expect(f.viewer.mock.calls[0]![1]).toMatchObject({ type: "equirectangular", panorama: "https://img.invalid/derivatives/pano.webp", crossOrigin: "anonymous", mouseZoom: false, keyboardZoom: true });
    expect(screen.getByRole("group", { name: /Use arrow keys to look around/ })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Close 360° view" }));
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("Synthetic panorama of a test street")).toBeTruthy();
  });
  it("unmounting destroys the viewer (no leak)", async () => {
    gl(8192);
    const u = userEvent.setup();
    const f = fakePannellum("load"); f.install();
    const { unmount } = render(<Panorama media={pano()} loadViewer={async () => {}} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    await waitFor(() => expect(f.viewer).toHaveBeenCalled());
    unmount();
    expect(f.destroy).toHaveBeenCalled();
  });
  it("no WebGL: message, static photo and caption stay, viewer never loaded", async () => {
    gl(null);
    const u = userEvent.setup();
    const load = vi.fn(async () => {});
    render(<Panorama media={pano()} loadViewer={load} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    expect(screen.getByRole("status").textContent).toContain("needs WebGL");
    expect(screen.getByAltText("Synthetic panorama of a test street")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });
  it("texture larger than the GPU limit: explained, still photo kept, viewer never loaded", async () => {
    gl(2048);
    const u = userEvent.setup();
    const load = vi.fn(async () => {});
    render(<Panorama media={pano({ width: 8192 })} loadViewer={load} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    expect(screen.getByRole("status").textContent).toContain("too large");
    expect(load).not.toHaveBeenCalled();
  });
  it.each([["error-webgl", /needs WebGL/], ["error-img", /could not be loaded/]] as const)("viewer error (%s) falls back to the still photo and destroys the viewer", async (outcome, re) => {
    gl(8192);
    const u = userEvent.setup();
    const f = fakePannellum(outcome); f.install();
    render(<Panorama media={pano()} loadViewer={async () => {}} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(re));
    expect(f.destroy).toHaveBeenCalled();
    expect(screen.getByAltText("Synthetic panorama of a test street")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explore in 360°" })).toBeTruthy();
  });
  it("a viewer script that fails to load is a message, not a crash", async () => {
    gl(8192);
    const u = userEvent.setup();
    render(<Panorama media={pano()} loadViewer={async () => { throw new Error("chunk failed"); }} />);
    await u.click(screen.getByRole("button", { name: "Explore in 360°" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/could not be loaded/));
  });
  it("an unsafe fallback URL is never rendered; the absence is stated", () => {
    const { container } = render(<Panorama media={pano({ staticFallbackUrl: "https://img.invalid/original/x.jpg" })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("No still photograph is available");
  });
  it("passes automated accessibility checks", async () => {
    const { container } = render(<Panorama media={pano()} />);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});
