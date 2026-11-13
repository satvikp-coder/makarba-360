// Opt-in: regenerates the README screenshots in docs/project/screenshots/. Skipped unless SCREENSHOTS=1, so it never runs in CI or a
// normal test run:  SCREENSHOTS=1 pnpm exec playwright test e2e/zz-screens.spec.ts --workers=1
import { expect, test } from "@playwright/test";
const OUT = "../../docs/project/screenshots/";
test.skip(!process.env.SCREENSHOTS, "screenshots are regenerated only on request (SCREENSHOTS=1)");
const ready = (page: import("@playwright/test").Page) => expect(page.locator('.map-wrap[data-map-status="ready"]')).toBeVisible({ timeout: 30_000 });
test("readme shots", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?preloader");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}v3-preloader.png` });
  await page.waitForFunction(() => !document.querySelector(".preloader"), null, { timeout: 30000 });
  await page.goto("/explore?future=1&year=2040");
  await ready(page);
  await page.getByRole("button", { name: /AI insights/ }).click();
  await expect(page.locator(".ai-hl > li").first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}v3-future-2040.png` });
  await page.goto("/explore");
  await ready(page);
  await page.getByRole("button", { name: "Start story tour" }).click();
  await page.getByRole("button", { name: "Next stop" }).click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}v3-tour-roza.png` });
  await page.goto("/forecasts");
  await ready(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}v3-outlook.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await ready(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}v3-phone-explore.png` });
});
