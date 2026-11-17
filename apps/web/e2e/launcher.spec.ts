import { expect, test } from "@playwright/test";

test("the mock API root opens the web app and the web server proxies public data", async ({ page, request }) => {
  const apiPort = process.env.MOCK_API_PORT ?? "4010";
  const webPort = process.env.WEB_PORT ?? "5173";
  const root = await request.get(`http://127.0.0.1:${apiPort}/`, { maxRedirects: 0 });
  expect(root.status()).toBe(302);
  expect(root.headers().location).toBe(`http://localhost:${webPort}/`);
  await page.goto(`http://127.0.0.1:${apiPort}/`);
  await expect(page).toHaveURL(`http://localhost:${webPort}/`);
  await expect(page.getByRole("heading", { name: "Makarba 360°", level: 1 })).toBeVisible();
  const response = await request.get(`http://127.0.0.1:${webPort}/api/v1/public/locations`);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("json");
});

test("the shipped forecast and pre-generated insights load when changing years", async ({ page }) => {
  await page.goto("/forecasts?year=2040");
  await expect(page.getByRole("heading", { level: 1, name: "Where the trends point by 2040" })).toBeVisible();
  await expect(page.getByRole("img", { name: /forecast to 2040/ }).first()).toBeVisible();
  await page.getByRole("tab", { name: "AI insights" }).click();
  await expect(page.getByText("AI-generated highlights")).toBeVisible();
  await expect(page.getByText(/pre-generated/).first()).toBeVisible();
  await page.getByRole("slider", { name: /Forecast to/ }).fill("2041");
  await expect(page).toHaveURL(/year=2041/);
  await expect(page.getByRole("heading", { level: 1, name: "Where the trends point by 2041" })).toBeVisible();
  await expect(page.getByText("AI-generated highlights")).toBeVisible();
});

test("AI highlights navigate in both directions and show their details in the side panel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore?future=1&year=2040");
  const dock = page.getByRole("region", { name: "AI insights" });
  await dock.getByRole("button", { name: /AI insights/ }).click();
  await expect(dock.getByText("1 / 4")).toBeVisible();
  await expect(dock.getByRole("button", { name: /Previous/ })).toBeDisabled();
  await page.getByRole("button", { name: "Hide side panel" }).click();
  await dock.getByRole("button", { name: /Next/ }).click();
  await expect(dock.getByText("2 / 4")).toBeVisible();
  const title = await dock.locator(".ai-hl-btn b").innerText();
  const side = page.getByRole("region", { name: "Selected AI highlight" });
  await expect(side.getByRole("heading", { name: title })).toBeVisible();
  await expect(side.getByText(/AI-generated/)).toBeVisible();
  await dock.getByRole("button", { name: /Previous/ }).click();
  await expect(dock.getByText("1 / 4")).toBeVisible();
  await expect(side.getByRole("heading", { name: title })).toHaveCount(0);
});

test("AI highlight selection is available on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore?future=1&year=2040");
  const dock = page.getByRole("region", { name: "AI insights" });
  await dock.getByRole("button", { name: /AI insights/ }).click();
  await expect(dock.getByText("1 / 4")).toBeVisible();
  await dock.getByRole("button", { name: /Next/ }).click();
  const title = await dock.locator(".ai-hl-btn b").innerText();
  await expect(page.getByRole("region", { name: "Selected AI highlight" }).getByRole("heading", { name: title })).toBeVisible();
});

test("map controls give pointer feedback and respect reduced motion", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator('.map-wrap[data-map-status="ready"][data-rendered="true"]')).toBeVisible({ timeout: 25_000 });
  const button = page.getByRole("button", { name: "360° camera" });
  await expect(button).toBeVisible();
  const initial = await button.getAttribute("aria-pressed");
  const background = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
  await button.hover();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(background);
  await page.mouse.down();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).translate)).toMatch(/1px/);
  await page.mouse.up();
  await expect(button).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedButton = page.getByRole("button", { name: "3D buildings" });
  await reducedButton.hover();
  await page.mouse.down();
  expect(await reducedButton.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
  await page.mouse.up();
});
