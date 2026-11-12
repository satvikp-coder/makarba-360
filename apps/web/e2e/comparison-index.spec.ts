import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixture = JSON.parse(readFileSync(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url), "utf8"));

test("navigation reaches a synthetic place comparison", async ({ page }) => {
  await page.route("**/api/v1/public/locations?*", (route) => route.fulfill({ json: fixture.locations }));
  await page.route("**/api/v1/public/locations/*/history", (route) => route.fulfill({ json: { ...fixture.history, comparisonPairs: [] } }));
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Then & Now" }).click();
  const place = fixture.locations.features[0];
  await page.getByRole("link", { name: place.properties.name.en }).click();
  await expect(page).toHaveURL(new RegExp(`/places/${place.properties.slug}/then-and-now$`));
  await expect(page.getByText("No comparisons are available for this place yet.")).toBeVisible();
});
