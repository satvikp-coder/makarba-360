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
