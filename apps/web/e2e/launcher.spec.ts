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
