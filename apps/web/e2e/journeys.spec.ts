import { expect, test, type Page } from "@playwright/test";

// 1x1 transparent PNG so no request ever leaves the machine for map tiles.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const FIRST = "Synthetic Atlas Point";

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
    await expect(page.getByText(/OpenStreetMap contributors/)).toBeVisible();
    await expect(page.getByText("Demonstration place data (synthetic)")).toBeVisible();
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
    await page.goto("/places/synthetic-point");
    await expect(page.getByRole("heading", { level: 1, name: FIRST })).toBeVisible();
    await expect(page.getByText("No approved description has been published yet.")).toBeVisible();
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
    await expect(page.getByText(/OpenStreetMap contributors/)).toBeVisible();
  });

  test("sheet controls are at least 44px touch targets", async ({ page }) => {
    await prepare(page);
    await page.goto("/explore");
    const box = await page.getByRole("button", { name: "Expand" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
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
      for (const n of ["Explore", "Then & Now", "Community Voices", "Urban Insights", "Research"]) {
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
