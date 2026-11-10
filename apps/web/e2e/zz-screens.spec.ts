// Opt-in: regenerates docs/project/screenshots/ with every non-local request aborted (offline). Skipped unless SCREENSHOTS=1,
// so it never runs in CI or a normal test run:  SCREENSHOTS=1 pnpm exec playwright test e2e/zz-screens.spec.ts --workers=1
import { expect, test } from "@playwright/test";
const OUT = "../../docs/project/screenshots/";
test.skip(!process.env.SCREENSHOTS, "screenshots are regenerated only on request (SCREENSHOTS=1)");
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  await page.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (r) => r.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });   // deterministic frames: no intro flight
});
const ready = (page: import("@playwright/test").Page) => expect(page.locator('.map-wrap[data-map-status="ready"][data-rendered="true"]')).toBeVisible({ timeout: 30_000 });
test("screens", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/explore");
  await ready(page);
  await page.waitForTimeout(2500);
  await page.locator(".explore").screenshot({ path: OUT + "01-explore-3d-day.png" });
  await page.getByRole("button", { name: "Start story tour" }).click();
  await page.getByRole("button", { name: "Next stop" }).click();
  await page.waitForTimeout(2500);
  await page.locator(".map-wrap").screenshot({ path: OUT + "02-story-tour-sarkhej-roza.png" });
  await page.getByRole("button", { name: "End story tour" }).first().click();
  await page.getByRole("button", { name: "Night" }).click();
  await page.getByRole("button", { name: "Junction fruit and sugarcane carts" }).click();
  await page.waitForTimeout(2500);
  await page.locator(".explore").screenshot({ path: OUT + "03-night-selection.png" });
  await page.goto("/");
  await page.getByRole("heading", { name: "Landmarks around Makarba" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "04-landmark-notes.png" });
});
