import { expect, test, type Page } from "@playwright/test";

// The Makarba demo map must work with NO network beyond the site itself: every request to another host is aborted and recorded.
const FIRST = "Junction fruit and sugarcane carts";

async function offline(page: Page) {
  const external: string[] = [];
  await page.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => { external.push(route.request().url()); return route.abort("internetdisconnected"); });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { external, errors };
}
const ready = (page: Page) => expect(page.locator('.map-wrap[data-map-status="ready"][data-rendered="true"]')).toBeVisible({ timeout: 25_000 });
const running = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);

test.describe("offline 3D Makarba demo map (all non-local requests aborted)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("renders the self-contained basemap, 3D buildings and places with zero external requests", async ({ page }) => {
    const { external, errors } = await offline(page);
    await page.goto("/explore");
    await ready(page);
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.locator(".map-label--landmark", { hasText: "Sarkhej Roza" })).toHaveCount(1);
    await expect(page.getByText(/Makarba 360 sketch map/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Map legend" })).toContainText("Heritage");
    // a blank or failed WebGL canvas compresses to a tiny PNG; a drawn map with roads, water and buildings does not
    const shot = await page.locator(".map").screenshot();
    expect(shot.length).toBeGreaterThan(30_000);
    await page.getByRole("button", { name: FIRST }).click();
    const sel = page.getByRole("complementary", { name: "Selected place" });
    await expect(sel).toContainText("Helfmann, CC BY-SA 4.0");
    await expect(sel.getByRole("link", { name: /Open profile/ })).toBeVisible();
    await expect(page.locator(".map-pulse")).toHaveCount(1);
    expect(external, external.join("\n")).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("lighting, 3D and motion controls are keyboard operable buttons with pressed state", async ({ page }) => {
    await offline(page);
    await page.goto("/explore");
    await ready(page);
    const wrap = page.locator(".map-wrap");
    await page.getByRole("button", { name: "Night" }).focus();
    await page.keyboard.press("Enter");
    await expect(wrap).toHaveAttribute("data-time", "night");
    await expect(page.getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "3D buildings" }).click();
    await expect(page.getByRole("button", { name: "3D buildings" })).toHaveAttribute("aria-pressed", "false");
    const pause = page.getByRole("button", { name: /Pause motion|Play motion/ });
    const before = await wrap.getAttribute("data-paused");
    await pause.click();
    await expect(wrap).not.toHaveAttribute("data-paused", before!);
  });

  test("full motion: the intro flies in and finishes; motion can be paused (WCAG 2.2.2)", async ({ page }) => {
    await offline(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/explore");
    await ready(page);
    const wrap = page.locator(".map-wrap");
    await expect(wrap).toHaveAttribute("data-motion", "full");
    await expect(wrap).toHaveAttribute("data-intro", "done", { timeout: 15_000 });
    await expect(wrap).toHaveAttribute("data-paused", "false");
    await page.getByRole("button", { name: "Pause motion" }).click();
    await expect(wrap).toHaveAttribute("data-paused", "true");
  });

  test("reduced motion: no intro flight, ambient motion paused, no running CSS animations even after selecting", async ({ page }) => {
    await offline(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore");
    await ready(page);
    const wrap = page.locator(".map-wrap");
    await expect(wrap).toHaveAttribute("data-motion", "reduced");
    await expect(wrap).toHaveAttribute("data-intro", "done");
    await expect(wrap).toHaveAttribute("data-paused", "true");
    expect(await running(page)).toBe(0);
    await page.getByRole("button", { name: FIRST }).click();
    await expect(page.locator(".map-pulse")).toHaveCount(1);
    expect(await running(page)).toBe(0);
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 2, name: "weekend-visitors" })).toBeVisible();
    expect(await running(page)).toBe(0);
  });

  test("story tour: flies through landmarks then places; sources in a tooltip; 360 camera turns", async ({ page }) => {
    test.slow();   // eight camera flights plus the 360° camera on software-rendered WebGL
    await offline(page);
    await page.goto("/explore");
    await ready(page);
    await page.getByRole("button", { name: "Start story tour" }).click();
    const tour = page.getByRole("region", { name: "Story tour" });
    await expect(tour).toBeFocused();
    await expect(tour).toContainText("Stop 1 of 19");
    await expect(tour.getByLabel(/^Source: /)).toBeVisible();
    await page.getByRole("button", { name: "Next stop" }).click();
    await expect(tour).toContainText("Sarkhej Roza");
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Next stop" }).click();
    await expect(tour).toContainText("Stop 8 of 19");
    await expect(tour.getByRole("button", { name: "Open details" })).toBeVisible();   // stop 8: the first published place
    await tour.getByRole("button", { name: "End story tour" }).click();
    await expect(tour).toHaveCount(0);
    await page.getByRole("button", { name: "360° camera" }).click();
    await expect(page.getByRole("button", { name: "360° camera" })).toHaveAttribute("aria-pressed", "true");
  });

  test("WebGL unavailable: a flat 2D sketch and the full list replace the 3D map", async ({ page }) => {
    const { external } = await offline(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...x: unknown[]) => unknown).call(this, type, ...a) as RenderingContext | null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto("/explore");
    await expect(page.getByRole("img", { name: /Flat 2D sketch/ })).toBeVisible();
    await expect(page.getByText("Showing all 12 places.")).toBeVisible();
    expect(external).toEqual([]);
  });
});

test.describe("honest disclosure and sourced landmarks", () => {
  test("every public page has the calm footer disclosure, which leads to the full explanation", async ({ page }) => {
    await offline(page);
    for (const route of ["/", "/explore", "/places/junction-fruit-carts", "/voices", "/insights", "/research/sources"]) {
      await page.goto(route);
      await expect(page.getByRole("contentinfo"), route).toContainText("Forecasts: Google TimesFM 3.0");
      await expect(page.getByRole("contentinfo"), route).not.toContainText(/demo|example|prototype|fictional/i);
    }
    await page.getByRole("contentinfo").getByRole("link", { name: "About the data" }).click();
    await expect(page).toHaveURL(/\/research\/methodology#prototype-data$/);
    await expect(page.getByRole("heading", { level: 2, name: "About the data" })).toBeInViewport();
  });
  test("landmark notes are marked as sourced, list their sources and are kept apart from demo places", async ({ page }) => {
    const { external } = await offline(page);
    await page.goto("/");
    const roza = page.getByRole("article", { name: "Sarkhej Roza" });
    await expect(roza).toContainText("Why it matters");
    await expect(roza.getByRole("link", { name: "Wikipedia: Sarkhej Roza" })).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Sarkhej_Roza");
    // the Wikimedia Commons photo is bundled with the site: it decodes with every external request aborted, and its credit is visible
    const photo = roza.getByRole("img");
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute("src", "/media/landmarks/sarkhej-roza.jpg");
    await expect.poll(() => photo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(960);
    await expect(roza).toContainText("Photo: Museeb fakih, Public domain, via Wikimedia Commons");
    await expect(page.getByRole("article", { name: "Ahmed Shah I and Ahmedabad" })).toContainText("not a photograph");
    await page.goto("/explore?place=00000000-0000-4000-8000-000000000010");
    const aside = page.getByRole("complementary", { name: "Selected place" });
    await aside.getByText("Sourced notes").click();
    await expect(aside.getByRole("article", { name: "Sarkhej Roza" })).toContainText("Sources:");
    await expect(page.locator(".demo-badge")).toHaveCount(0);
    expect(external, external.join("\n")).toEqual([]);
  });
  test("profile shows a timeline with sources in tooltips; voices are attributed; nothing can be submitted", async ({ page }) => {
    await offline(page);
    await page.goto("/places/canal-bank-walk");
    await expect(page.locator(".timeline li").first()).toContainText(/\u2013 [A-Z]/);
    await expect(page.locator(".timeline li").first()).not.toContainText("Example:");
    await expect(page.locator(".timeline li").first().getByRole("button", { name: /^Source: Makarba 360 dataset/ })).toBeVisible();
    await page.goto("/voices");
    await expect(page.getByText(/Resident voice/).first()).toBeVisible();
    for (const p of ["/", "/explore", "/voices", "/insights"]) {
      await page.goto(p);
      await expect(page.locator("form:not([role=search]), textarea, input[type=file]")).toHaveCount(0);
    }
  });
  test("insights: counters settle on the real value and the hidden group never shows a number", async ({ page }) => {
    await offline(page);
    await page.goto("/insights");
    const g = page.getByRole("heading", { level: 2, name: "weekend-visitors" }).locator("xpath=..");
    await expect(g.getByRole("row", { name: /People interviewed/ })).toContainText("48");
    const hidden = page.getByRole("heading", { level: 2, name: "canal-bank-small" }).locator("xpath=..");
    await expect(hidden).toContainText("Hidden to protect privacy");
    await expect(hidden.getByRole("table")).toHaveCount(0);
  });
});
