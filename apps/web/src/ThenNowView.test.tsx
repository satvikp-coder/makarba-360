import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MediaData } from "./api.js";
import { ThenNow, ThenNowSection } from "./ThenNowView.js";
import type { PairInput } from "./thenNow.js";

afterEach(cleanup);
const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const pair: PairInput & { beforeMediaId: string; afterMediaId: string } = {
  id: "p1", beforeMediaId: "b", afterMediaId: "a", beforeDate: { value: "2021", precision: "year" }, afterDate: { value: "2026-01-01", precision: "day" },
  sourceIds: ["s1"], matchingViewpointNotes: "Synthetic matching test only", evidenceQuality: "synthetic",
};
const media = (id: string): MediaData => ({ id, url: `https://img.invalid/${id}.png`, alt: `Synthetic ${id} photo`, credit: "Synthetic credit", licence: "test-only", capturedDate: { value: "2021", precision: "year" }, format: "image", width: 40, height: 30 });
const sources = [{ id: "s1", citation: "Invented test citation" }];
const ui = (p: PairInput = pair, b: MediaData | null = media("b"), a: MediaData | null = media("a")) => render(<ThenNow pair={p} before={b} after={a} sources={sources} />);

describe("ThenNow component", () => {
  it("shows slider with dates, sources, quality and viewpoint; passes axe", async () => {
    const { container } = ui();
    const s = screen.getByRole("slider", { name: "Compare before and after" });
    expect(s.getAttribute("aria-valuenow")).toBe("50");
    const t = container.textContent!;
    for (const x of ["2021 (year)", "2026-01-01 (exact day)", "Invented test citation", "Evidence quality: synthetic", "Matched viewpoint: Synthetic matching test only"]) expect(t).toContain(x);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("keyboard moves the slider: arrows, PageUp/Down, Home/End; other keys ignored", () => {
    ui();
    const s = screen.getByRole("slider");
    s.focus();
    const now = () => s.getAttribute("aria-valuenow");
    fireEvent.keyDown(s, { key: "ArrowRight" }); expect(now()).toBe("55");
    fireEvent.keyDown(s, { key: "ArrowLeft" }); fireEvent.keyDown(s, { key: "ArrowLeft" }); expect(now()).toBe("45");
    fireEvent.keyDown(s, { key: "PageUp" }); expect(now()).toBe("70");
    fireEvent.keyDown(s, { key: "End" }); expect(now()).toBe("100");
    fireEvent.keyDown(s, { key: "ArrowRight" }); expect(now()).toBe("100");
    fireEvent.keyDown(s, { key: "Home" }); expect(now()).toBe("0");
    fireEvent.keyDown(s, { key: "a" }); expect(now()).toBe("0");
  });
  it("side-by-side and text views are reachable without dragging", () => {
    ui();
    fireEvent.click(screen.getByLabelText("Side by side"));
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByText(/Before: 2021 \(year\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Text description"));
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getByText(/Evidence quality: synthetic/)).toBeTruthy();
  });
  it("an unknown date is never shown as exact and the pair is hidden", () => {
    const { container } = ui({ ...pair, beforeDate: { value: null, precision: "unknown" } });
    expect(container.innerHTML).toBe("");
  });
  it.each([["no source", { sourceIds: [] }], ["unknown after date", { afterDate: { value: "", precision: "unknown" } }]])("hides unsupported pair: %s", (_n, o) => {
    expect(ui({ ...pair, ...o }).container.innerHTML).toBe("");
  });
  it("hides the pair when an image is missing or not https", () => {
    expect(ui(pair, null, media("a")).container.innerHTML).toBe("");
    cleanup();
    expect(ui(pair, { ...media("b"), url: "http://img.invalid/b.png" }, media("a")).container.innerHTML).toBe("");
  });
  it("does not claim a matched viewpoint without a note", () => {
    ui({ ...pair, matchingViewpointNotes: "" });
    expect(screen.queryByText(/Matched viewpoint/)).toBeNull();
    expect(screen.getByText("Not a like-for-like view.")).toBeTruthy();
  });
  it("image failure keeps the narrative and removes the broken images", () => {
    ui();
    fireEvent.error(screen.getAllByRole("img")[0]!);
    expect(screen.getByRole("status").textContent).toContain("An image is unavailable");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByText(/Evidence quality: synthetic/)).toBeTruthy();
    expect(screen.getByText(/Invented test citation/)).toBeTruthy();
  });
});

describe("ThenNowSection (fetches the two images)", () => {
  const respond = (ids: Record<string, "ok" | 404 | 500>): typeof fetch => (async (u: RequestInfo | URL) => {
    const id = String(u).split("/").pop()!;
    const st = ids[id] ?? 404;
    if (st !== "ok") return new Response("{}", { status: st });
    return new Response(JSON.stringify({ ...bundle.media, id }), { status: 200 });
  }) as typeof fetch;
  it("renders once both images load", async () => {
    render(<ThenNowSection pairs={[pair]} sources={sources} fetcher={respond({ a: "ok", b: "ok" })} />);
    expect(await screen.findByRole("slider")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Then & Now" })).toBeTruthy();
  });
  it("omits the whole section when either image is unavailable", async () => {
    const { container } = render(<ThenNowSection pairs={[pair]} sources={sources} fetcher={respond({ a: "ok", b: 404 })} />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
  it("renders nothing for an empty pair list and makes no request", () => {
    let calls = 0;
    const f = (async () => { calls++; return new Response("{}"); }) as typeof fetch;
    const { container } = render(<ThenNowSection pairs={[]} sources={sources} fetcher={f} />);
    expect(container.innerHTML).toBe(""); expect(calls).toBe(0);
  });
});
