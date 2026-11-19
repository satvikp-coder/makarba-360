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

test("the stored AI insights follow the year on the map, labelled AI-generated, and no model is ever called", async ({ page }) => {
  const modelCalls: string[] = [];
  page.on("request", (r) => { if (/\/(applefm|ollama|groq)\b/.test(r.url())) modelCalls.push(r.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore?future=1&year=2040");
  const dock = page.getByRole("region", { name: "AI insights" });
  await expect(dock).toContainText("highlights · 2040");
  await dock.getByRole("button", { name: /AI insights/ }).click();
  await expect(dock.getByText("AI-generated", { exact: true })).toBeVisible();
  await expect(dock).not.toContainText(/pre-generated|apple|ollama|groq/i);
  await dock.getByText("Briefing for 2040").click();
  await expect(dock.locator(".briefing-text")).toBeVisible();
  await page.getByRole("slider", { name: "Year on the map" }).fill("2045");
  await expect(dock).toContainText("highlights · 2045");
  expect(modelCalls).toEqual([]);
});

test("the timeline updates Overview figures and the Outlook year", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("slider", { name: "Year on the map" }).fill("2040");
  await expect(page.getByRole("heading", { name: "Outlook for 2040" })).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Outlook" }).click();
  // Outlook is a lazy page: on a busy dev server its first compile can take longer than the default 5 s
  await expect(page.getByRole("heading", { name: "Where the trends point by 2040" })).toBeVisible({ timeout: 20_000 });
});

for (const width of [375, 1280]) {
  test(`the AI insights dock fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore?future=1&year=2040");
    const dock = page.getByRole("region", { name: "AI insights" });
    await dock.getByRole("button", { name: /AI insights/ }).click();
    const chip = dock.locator(".who-chips li").first();
    await expect(chip).toBeVisible();
    expect(await chip.evaluate((el) => getComputedStyle(el).display)).not.toBe("grid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // the year control stays on screen beside the open future panel
    await expect(page.getByRole("slider", { name: "Year on the map" })).toBeInViewport();
  });
}

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

test("the tour side panel can be closed and reopened on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await page.getByRole("button", { name: "Start story tour" }).click();
  const side = page.getByRole("region", { name: "Current tour stop" });
  await expect(side).toContainText("Stop 1 of");
  await page.getByRole("button", { name: "Hide side panel" }).click();
  await expect(side).toBeHidden();
  await page.getByRole("button", { name: "Show side panel" }).click();
  await expect(side).toBeVisible();
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

test("the 3D city loads even when the places service is down, and the places appear once it recovers", async ({ page }) => {
  let down = true;
  await page.route("**/api/v1/public/locations**", (r) => (down ? r.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : r.continue()));
  await page.goto("/explore");
  await expect(page.locator('.map-wrap[data-map-status="ready"]')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".map-label--place")).toHaveCount(0);
  down = false;
  await expect(page.locator(".map-label--place").first()).toBeAttached({ timeout: 20_000 });
});
