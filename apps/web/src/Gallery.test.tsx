import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { MediaData } from "./api.js";
import { Gallery, safeImageUrl } from "./Gallery.js";

// jsdom does not implement the modal dialog API; model open/close so the component's real code path runs.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

const m = (id: string, o: Partial<MediaData> = {}): MediaData => ({
  id, url: `https://img.invalid/derivatives/${id}.webp`, alt: `Synthetic photo ${id}`, credit: "Synthetic credit", licence: "test-only",
  capturedDate: { value: "2021", precision: "year" }, format: "image", width: 40, height: 30, ...o,
});

describe("safeImageUrl", () => {
  it("accepts https derivatives only and refuses original-storage and plain http paths", () => {
    expect(safeImageUrl("https://cdn.invalid/derivatives/a.webp")).toBe(true);
    for (const u of ["http://cdn.invalid/a.webp", "https://cdn.invalid/original/a.jpg", "https://cdn.invalid/Originals/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "/relative.png"]) expect(safeImageUrl(u)).toBe(false);
  });
});

describe("Gallery grid", () => {
  it("shows each photograph with alt text, date as recorded, credit and licence", async () => {
    const { container } = render(<Gallery items={[m("a"), m("b")]} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByAltText("Synthetic photo a")).toBeTruthy();
    expect(container.textContent).toContain("2021 (year)");
    expect(container.textContent).toContain("Synthetic credit · test-only");
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("unknown dates are not made up", () => {
    const { container } = render(<Gallery items={[m("a", { capturedDate: { value: null, precision: "unknown" } })]} />);
    expect(container.textContent).toContain("Date unknown");
  });
  it("empty list says so", () => { render(<Gallery items={[]} />); expect(screen.getByText("No approved photographs yet.")).toBeTruthy(); });
  it("unavailable, http, and original-storage items are not rendered and are counted honestly", () => {
    render(<Gallery items={[m("ok"), "unavailable", m("h", { url: "http://img.invalid/h.webp" }), m("o", { url: "https://img.invalid/original/o.jpg" })]} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("3 photographs are unavailable.");
    expect(document.body.innerHTML).not.toContain("/original/");
  });
  it("an image that fails to load is replaced by the unavailable note", () => {
    render(<Gallery items={[m("a"), m("b")]} />);
    fireEvent.error(screen.getByAltText("Synthetic photo a"));
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("A photograph is unavailable.");
  });
  it("images never send a referrer and are not draggable out of the page", () => {
    render(<Gallery items={[m("a")]} />);
    const img = screen.getByAltText("Synthetic photo a");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img.getAttribute("draggable")).toBe("false");
  });
});

describe("Lightbox", () => {
  it("opens from the thumbnail with caption details, navigates with buttons and arrow keys (wrapping), and closes", async () => {
    const u = userEvent.setup();
    render(<Gallery items={[m("a"), m("b"), m("c")]} />);
    await u.click(screen.getByRole("button", { name: "Open photograph: Synthetic photo b" }));
    const dlg = document.querySelector("dialog")!;
    expect(dlg.hasAttribute("open")).toBe(true);
    expect(dlg.textContent).toContain("Photograph 2 of 3");
    expect(dlg.textContent).toContain("Synthetic credit · test-only");
    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(dlg.textContent).toContain("Photograph 3 of 3");
    fireEvent.keyDown(dlg, { key: "ArrowRight" });
    expect(dlg.textContent).toContain("Photograph 1 of 3");
    fireEvent.keyDown(dlg, { key: "ArrowLeft" });
    expect(dlg.textContent).toContain("Photograph 3 of 3");
    await u.click(screen.getByRole("button", { name: "Close" }));
    expect(dlg.hasAttribute("open")).toBe(false);
  });
  it("a single photograph disables previous/next", async () => {
    const u = userEvent.setup();
    render(<Gallery items={[m("a")]} />);
    await u.click(screen.getByRole("button", { name: /Open photograph/ }));
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("returns focus to the thumbnail that opened it", async () => {
    const u = userEvent.setup();
    render(<Gallery items={[m("a"), m("b")]} />);
    const thumb = screen.getByRole("button", { name: "Open photograph: Synthetic photo b" });
    await u.click(thumb);
    await u.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(thumb);
  });
  it("closes if the image in the lightbox fails", async () => {
    const u = userEvent.setup();
    render(<Gallery items={[m("a")]} />);
    await u.click(screen.getByRole("button", { name: /Open photograph/ }));
    const imgs = screen.getAllByAltText("Synthetic photo a");
    fireEvent.error(imgs[imgs.length - 1]!);
    expect(document.querySelector("dialog")!.hasAttribute("open")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("A photograph is unavailable.");
  });
});
