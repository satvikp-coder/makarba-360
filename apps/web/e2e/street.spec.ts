import { expect, test } from "@playwright/test";

test("street view: the 3D streets load, the camera modes switch, captions follow the film, and Escape returns to the map", async ({ page }) => {
  test.slow();   // a full WebGL scene on software rendering
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/street");
  await expect(page.getByRole("radiogroup", { name: "Camera" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".street-canvas canvas")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Cinematic" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".street-caption h2")).toHaveText("Makarba, Ahmedabad", { timeout: 15_000 });
  await page.getByRole("button", { name: "Jump to Fruit seller on Sarkhej Roza Road" }).click();
  await expect(page.locator(".street-caption h2")).toHaveText("Fruit seller on Sarkhej Roza Road", { timeout: 15_000 });
  await page.getByRole("radio", { name: "Walk" }).click();
  await expect(page.getByText(/walk · drag to look/)).toBeVisible();
  await page.keyboard.down("KeyW"); await page.waitForTimeout(400); await page.keyboard.up("KeyW");
  await page.getByRole("radio", { name: "Drone" }).click();
  await expect(page.getByRole("radio", { name: "Drone" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator(".map-wrap")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
