import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// 1x1 transparent PNG so no request ever leaves the machine for map tiles.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const FIRST = "Junction fruit and sugarcane carts";
// Synthetic 2:1 test image (gradient, no real place) for the equirectangular viewer.
const PANO = readFileSync(new URL("./fixtures/synthetic-pano-64x32.png", import.meta.url));

async function prepare(page: Page) {
  const apiCalls: string[] = [];
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => { if (r.url().includes("/api/")) { const u = new URL(r.url()); apiCalls.push(u.pathname + u.search); } });
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  return { apiCalls, errors };
}
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("desktop 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("real MapLibre canvas renders, selection is in the URL and back/forward work", async ({ page }) => {
    const { apiCalls, errors } = await prepare(page);
    await page.goto("/explore");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.getByText(/approximate sketch drawn for this prototype/)).toBeVisible();
    await expect(page.getByText(/^Places: Makarba 360 demo dataset · /)).toBeVisible();
    await page.getByRole("button", { name: FIRST }).click();
    await expect(page).toHaveURL(/place=00000000-0000-4000-8000-000000000001/);
    await expect(page.getByRole("complementary", { name: "Selected place" })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/place=/);
    await expect(page.getByRole("complementary", { name: "Selected place" })).toHaveCount(0);
    await page.goForward();
    await expect(page.getByRole("complementary", { name: "Selected place" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: FIRST })).toBeVisible();
    expect(errors).toEqual([]);
    for (const u of apiCalls) expect(u).toMatch(/^\/api\/v1\/public\/locations(\?limit=\d+)?$/);
  });

  test("side panel is a persistent column with all essential controls", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    await expect(page.getByRole("button", { name: FIRST })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  });

  test("keyboard: skip link first, selection by keyboard", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.getByRole("button", { name: FIRST }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/place=/);
  });

  test("WebGL unavailable: map message appears and the list still works", async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...x: unknown[]) => unknown).call(this, type, ...a) as RenderingContext | null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto("/explore");
    await expect(page.getByText(/map is unavailable on this device/)).toBeVisible();
    await page.getByRole("button", { name: FIRST }).click();
    await expect(page).toHaveURL(/place=/);
    await expect(page.getByRole("complementary", { name: "Selected place" })).toBeVisible();
  });

  test("profile page and unpublished place", async ({ page }) => {
    const { apiCalls } = await prepare(page);
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByRole("heading", { level: 1, name: FIRST })).toBeVisible();
    await page.goto("/places/not-published");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(apiCalls.filter((u) => u.includes("not-published"))).toEqual([]);
  });

  test("home page has no horizontal scroll and an Explore action that reaches the map", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("link", { name: "Explore the map" }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  });
});

test.describe("mobile 375x667 bottom sheet", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test("peek, expand, collapse by buttons and Escape; navigation never hidden", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    const sheet = page.locator(".sheet");
    await expect(sheet).toHaveAttribute("data-state", "peek");
    expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(113);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Expand" }).click();
    await expect(sheet).toHaveAttribute("data-state", "full");
    await expect(page.getByRole("button", { name: FIRST })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveAttribute("data-state", "peek");
    await page.getByRole("button", { name: "Expand" }).click();
    await page.getByRole("button", { name: "Collapse" }).click();
    await expect(sheet).toHaveAttribute("data-state", "half");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toHaveAttribute("data-state", "peek");
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("selecting a place opens the sheet and the map attribution stays visible", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore?place=00000000-0000-4000-8000-000000000001");
    await expect(page.locator(".sheet")).toHaveAttribute("data-state", "half");
    await expect(page.getByRole("heading", { level: 2, name: FIRST })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText(/approximate sketch drawn for this prototype/)).toBeVisible();
  });

  test("sheet controls are at least 44px touch targets", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    const box = await page.getByRole("button", { name: "Expand" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("navigation stays reachable when the mobile viewport shrinks for the keyboard", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    await page.getByRole("searchbox", { name: "Search places" }).focus();

    // Chromium cannot display a mobile OS keyboard. Shrinking the viewport models
    // browsers that resize their visual/layout viewport while the keyboard opens.
    await page.setViewportSize({ width: 375, height: 360 });
    await page.getByRole("button", { name: "Expand" }).click();

    const header = await page.locator("header").boundingBox();
    const sheet = await page.locator(".sheet").boundingBox();
    expect(header).not.toBeNull();
    expect(sheet).not.toBeNull();
    expect(header!.y).toBeGreaterThanOrEqual(0);
    expect(header!.y + header!.height).toBeLessThanOrEqual(sheet!.y + 1);

    for (const name of ["Overview", "Explore", "Outlook"]) {
      const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name });
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(360);
      await expect(link).toBeVisible();
    }
  });
});

test.describe("narrow, zoomed and rotated viewports keep navigation reachable", () => {
  const cases = [
    ["320px wide (equals 400 percent zoom of a 1280px window)", { width: 320, height: 568 }],
    ["landscape phone 667x375", { width: 667, height: 375 }],
    ["tablet 820x1180", { width: 820, height: 1180 }],
  ] as const;
  for (const [name, vp] of cases) {
    test(name, async ({ page }) => {
      await prepare(page);
      await page.setViewportSize(vp);
      await page.goto("/explore");
      expect(await noHorizontalScroll(page)).toBe(true);
      for (const n of ["Overview", "Explore", "Outlook"]) {
        const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: n });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
      }
      if (vp.width < 768) {
        await page.getByRole("button", { name: "Expand" }).click();
        await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Explore" }).scrollIntoViewIfNeeded();
        const link = await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Explore" }).boundingBox();
        const sheet = await page.locator(".sheet").boundingBox();
        expect(link!.y + link!.height).toBeLessThanOrEqual(sheet!.y + 1);
      }
    });
  }
});

test.describe("Then & Now (synthetic images, technical verification only)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const media = (id: string) => ({
    id, locationId: "00000000-0000-4000-8000-000000000001", url: `https://img.invalid/${id}.png`, contentType: "image/png", width: 40, height: 30, format: "image",
    alt: `Synthetic ${id} image`, credit: "Synthetic", licence: "synthetic-test-only", capturedDate: { value: "2021", precision: "year" }, publicationState: "published",
    staticFallbackUrl: "https://img.invalid/fallback.png", meta: { contractVersion: "1.0.0", datasetKind: "synthetic", snapshotId: id, methodologyUrl: "/research" },
  });
  async function stub(page: Page, failImages = false) {
    await prepare(page);
    for (const id of ["synthetic-before", "synthetic-after"]) {
      await page.route(new RegExp(`/api/v1/public/media/${id}$`), (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(media(id)) }));
    }
    await page.route(/img\.invalid/, (route) => (failImages ? route.abort() : route.fulfill({ status: 200, contentType: "image/png", body: PNG })));
  }

  test("slider works by keyboard, side by side and text views work, dates and sources shown", async ({ page }) => {
    await stub(page);
    await page.goto("/places/junction-fruit-carts");
    const slider = page.getByRole("slider", { name: "Compare before and after" });
    await expect(slider).toBeVisible();
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "55");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByText(/2021 \(year\)/).first()).toBeVisible();
    await expect(page.getByText(/Demo dataset/).first()).toBeVisible();
    await page.getByLabel("Side by side").check();
    await expect(slider).toHaveCount(0);
    await expect(page.getByText(/^Before: 2021/).first()).toBeVisible();
    await page.getByLabel("Text description").check();
    await expect(page.locator(".then-now img")).toHaveCount(0);
    await expect(page.getByText(/Evidence quality: synthetic/)).toBeVisible();
  });

  test("slider handle drags with the mouse", async ({ page }) => {
    await stub(page);
    await page.goto("/places/junction-fruit-carts");
    const area = page.locator(".tn-slider");
    await expect(area).toBeVisible();
    await area.scrollIntoViewIfNeeded();
    const box = (await area.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    const now = Number(await page.getByRole("slider").getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThan(10); expect(now).toBeLessThan(30);
  });

  test("image failure keeps the narrative; unsupported pair is hidden; no horizontal scroll at 320px", async ({ page }) => {
    await stub(page, true);
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByText(/An image is unavailable/)).toBeVisible();
    await expect(page.getByText(/Evidence quality: synthetic/)).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.unrouteAll();
    await prepare(page); // after-image endpoint missing: the pair cannot be shown
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Then & Now" })).toHaveCount(0);
  });
});

test.describe("map filters (real MapLibre canvas, stubbed tiles)", () => {
  test("category chip and layer toggle narrow list and URL; empty result keeps reset and attribution; back/forward restore", async ({ page }) => {
    const { errors } = await prepare(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/explore");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.getByText("Showing all 12 places.")).toBeVisible();
    await page.getByRole("button", { name: "Heritage" }).click();
    await expect(page).toHaveURL(/category=heritage/);
    await expect(page.getByText("Showing 1 of 12 places.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Canal bank walk" })).toHaveCount(0);
    // React Router 7 applies URL changes in a transition, so assert the new state with a retrying expect instead of .check()
    await page.getByRole("checkbox", { name: "Streets and routes" }).click();
    await expect(page.getByRole("checkbox", { name: "Streets and routes" })).toBeChecked();
    await expect(page.getByText(/No places match these filters/)).toBeVisible();
    await expect(page.getByText(/approximate sketch drawn for this prototype/)).toBeVisible();
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Showing 1 of 12 places.")).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Showing all 12 places.")).toBeVisible();
    await page.goForward();
    await page.goForward();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page).not.toHaveURL(/category=/);
    await expect(page.getByText("Showing all 12 places.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("filters are reachable and operable by keyboard at 375px", async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/explore?category=transport");
    await expect(page.getByRole("button", { name: "Transport" })).toHaveAttribute("aria-pressed", "true");
    const chip = page.getByRole("button", { name: "Heritage" });
    await chip.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/category=transport%2Cheritage/);
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test.describe("photo gallery and lightbox (real dialog element, synthetic image)", () => {
  test("opens, keeps page content inert, closes with Escape and returns focus; failing image shows note", async ({ page }) => {
    await prepare(page);
    await flatMedia(page);
    await page.route(/example\.invalid/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await page.goto("/places/junction-fruit-carts");
    const thumb = page.getByRole("button", { name: /Open photograph: Synthetic panorama placeholder/ });
    await thumb.scrollIntoViewIfNeeded();
    await thumb.focus();
    await page.keyboard.press("Enter");
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("synthetic-test-only");
    await expect(dlg).toContainText("2026-01-01 (exact day)");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      // native modal dialog makes the page inert: focus may leave to browser UI but never lands on page content
      expect(await page.evaluate(() => { const a = document.activeElement; return !a || a.tagName === "BODY" || !!a.closest("dialog"); })).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    await expect(thumb).toBeFocused();
  });

  test("a photograph that fails to load is replaced by a note; layout stays within 320px", async ({ page }) => {
    await prepare(page);
    await flatMedia(page);
    await page.route(/example\.invalid/, (route) => route.abort());
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByText("A photograph is unavailable.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open photograph/ })).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

// The mock now serves a real (Commons) photograph; viewer and gallery tests stub a fully synthetic record instead, so they keep
// testing the components against invented test images only.
const SYNTH_MEDIA = {
  url: "https://example.invalid/public/synthetic-panorama.webp", contentType: "image/webp", width: 4096, height: 2048, format: "equirectangular",
  alt: "Synthetic panorama placeholder; no real photograph supplied", credit: "Synthetic test asset descriptor", licence: "synthetic-test-only",
  capturedDate: { value: "2026-01-01", precision: "day" }, staticFallbackUrl: "https://example.invalid/public/synthetic-static.webp",
};
async function stubMedia(page: Page, extra: Record<string, unknown>) {
  await page.route(/\/api\/v1\/public\/media\/synthetic-media-1$/, async (route) => {
    const b = await (await route.fetch()).json();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...b, ...SYNTH_MEDIA, ...extra }) });
  });
}
const flatMedia = (page: Page) => stubMedia(page, { format: "image", width: 40, height: 30 });
const panoMedia = (page: Page) => stubMedia(page, {});

test.describe("owned panorama (real Pannellum viewer, real WebGL in headless Chromium, synthetic 64x32 image)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const cors = { "access-control-allow-origin": "*" };
  async function serve(page: Page, opts: { panoOk?: boolean } = {}) {
    await prepare(page);
    await panoMedia(page);
    await page.route(/example\.invalid\/public\/synthetic-static\.webp/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG, headers: cors }));
    await page.route(/example\.invalid\/public\/synthetic-panorama\.webp/, (r) => (opts.panoOk === false ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, contentType: "image/png", body: PANO, headers: cors })));
  }

  test("place page shows the still photo first; the viewer starts on request, takes arrow keys, closes cleanly", async ({ page }) => {
    const { errors } = await prepare(page);
    await serve(page);
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByRole("heading", { level: 1, name: FIRST })).toBeVisible();
    await expect(page.locator(".pnlm-container")).toHaveCount(0);       // not loaded until asked
    await expect(page.getByAltText(/Synthetic panorama placeholder/)).toBeVisible();
    await expect(page.getByText(/2026-01-01 \(exact day\)/).first()).toBeVisible();
    await page.getByRole("button", { name: "Explore in 360°" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Explore in 360°" }).click();
    await expect(page.locator(".pnlm-container canvas")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Close 360° view" })).toBeVisible();
    await page.locator(".pnlm-container").focus();
    await page.keyboard.press("ArrowLeft");
    await page.getByRole("button", { name: "Close 360° view" }).click();
    await expect(page.locator(".pnlm-container canvas")).toHaveCount(0);
    await expect(page.getByAltText(/Synthetic panorama placeholder/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("WebGL unavailable: the page still works and says why", async ({ page }) => {
    await serve(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...x: unknown[]) => unknown).call(this, type, ...a) as RenderingContext | null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto("/places/junction-fruit-carts");
    await page.getByRole("button", { name: "Explore in 360°" }).click();
    await expect(page.getByText(/needs WebGL/)).toBeVisible();
    await expect(page.getByAltText(/Synthetic panorama placeholder/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  });

  test("panorama image missing: falls back to the still photo with a message", async ({ page }) => {
    await serve(page, { panoOk: false });
    await page.goto("/places/junction-fruit-carts");
    await page.getByRole("button", { name: "Explore in 360°" }).click();
    await expect(page.getByText(/could not be loaded/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByAltText(/Synthetic panorama placeholder/)).toBeVisible();
    await expect(page.locator(".pnlm-container canvas")).toHaveCount(0);
  });
});

test.describe("place search (real map)", () => {
  test("search narrows list and map, survives reload and back/forward, selection restores; no-match keeps attribution", async ({ page }) => {
    const { errors, apiCalls } = await prepare(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/explore");
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search places" }).fill("CANAL");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=CANAL/);
    await expect(page.getByText(/1 place matches/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Canal bank walk" })).toBeVisible();
    await expect(page.getByRole("button", { name: FIRST })).toHaveCount(0);
    await page.getByRole("button", { name: "Canal bank walk" }).click();
    await expect(page).toHaveURL(/place=/);
    await page.reload();
    await expect(page.getByText(/1 place matches/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Canal bank walk" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search places" }).fill("nothing-here");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/No places match/)).toBeVisible();
    await expect(page.getByText(/approximate sketch drawn for this prototype/)).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByText("Showing all 12 places.")).toBeVisible();
    await page.goBack();
    await expect(page.getByText(/No places match/)).toBeVisible();
    expect(errors).toEqual([]);
    // searching is local: it never adds an API request containing the query
    for (const u of apiCalls) expect(u).not.toMatch(/CANAL|nothing-here/i);
  });

  test("search is usable at 375px and the input is at least 44px high", async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/explore?q=bus");
    await expect(page.getByText(/1 place matches/)).toBeVisible();
    const box = await page.getByRole("searchbox", { name: "Search places" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test.describe("panorama unavailable states", () => {
  test("blocked viewer script (third-party load denied): place page stays usable with a message", async ({ page }) => {
    await prepare(page);
    await panoMedia(page);
    await page.route(/example\.invalid/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG, headers: { "access-control-allow-origin": "*" } }));
    await page.route(/pannellum/i, (r) => r.abort());   // dev server path of the lazy viewer chunk (no API call contains this word)
    await page.goto("/places/junction-fruit-carts/panorama");
    await expect(page.getByRole("heading", { level: 1, name: /360° view: Junction fruit and sugarcane carts/ })).toBeVisible();
    await page.getByRole("button", { name: "Explore in 360°" }).click();
    await expect(page.getByText(/viewer could not be loaded/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByAltText(/Synthetic panorama placeholder/)).toBeVisible();
    await page.getByRole("link", { name: /← Junction fruit and sugarcane carts/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: FIRST })).toBeVisible();
  });
  test("a place with no panorama: profile and panorama page both say so", async ({ page }) => {
    await prepare(page);
    await flatMedia(page);
    await page.route(/example\.invalid/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await page.goto("/places/junction-fruit-carts");
    await expect(page.getByRole("button", { name: "Explore in 360°" })).toHaveCount(0);   // no placeholder, no empty viewer
    await page.goto("/places/junction-fruit-carts/panorama");
    await expect(page.getByRole("heading", { name: "No 360° view for this place" })).toBeVisible();
  });
});

test.describe("Urban Insights tables (synthetic mock snapshot)", () => {
  test("approved group tables, hidden group, selector with URL state, no total, only the public insights request", async ({ page }) => {
    const { apiCalls, errors } = await prepare(page);
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" })).toBeVisible();
    // two groups are ready in the prototype dataset, so each has its own Ratings table
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" }).locator("xpath=..").getByRole("table", { name: /Ratings/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /Ratings/ })).toHaveCount(2);
    const hidden = page.getByRole("heading", { level: 2, name: "canal-bank-small" }).locator("xpath=..");
    await expect(hidden).toContainText("Hidden to protect privacy");
    await expect(hidden.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(/no overall total is shown/)).toBeVisible();
    await page.getByRole("combobox", { name: /Group/ }).selectOption("canal-bank-small");
    await expect(page).toHaveURL(/cohort=canal-bank-small/);
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/Showing canal-bank-small/)).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(errors).toEqual([]);
    for (const u of apiCalls) expect(u).toBe("/api/v1/public/insights");
  });
  test("tables stay readable at 320px without sideways page scroll", async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});
