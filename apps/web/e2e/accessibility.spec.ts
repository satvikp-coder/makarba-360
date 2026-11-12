import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Automated accessibility audit in a real browser (#114, automated part only). Unlike the jsdom tests, colour contrast IS checked
// here. This does not replace review with a screen reader or on real devices, which remains a human task.
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function prepare(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.route(/example\.invalid/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG, headers: { "access-control-allow-origin": "*" } }));
}
/** Wait for the page heading, then give data fetches and lazy images a moment; "networkidle" is avoided because open image requests can keep it from settling. */
async function settle(page: Page) {
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(1200);
}
async function scan(page: Page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected into the page
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    return r.violations.map((v: { id: string; impact: string; nodes: { target: unknown[]; html: string }[] }) => ({ id: v.id, impact: v.impact, count: v.nodes.length, first: v.nodes[0]?.target?.join(" ") }));
  });
}

const ROUTES = [
  "/", "/explore", "/explore?place=00000000-0000-4000-8000-000000000001&category=heritage", "/places/junction-fruit-carts", "/places/junction-fruit-carts/then-and-now", "/places/junction-fruit-carts/panorama",
  "/voices", "/insights", "/research/methodology", "/research/sources", "/accessibility", "/stories/index", "/places/does-not-exist",
];

for (const [label, vp] of [["desktop", { width: 1280, height: 800 }], ["phone", { width: 375, height: 667 }]] as const) {
  test.describe(`axe (WCAG 2.2 AA + best practice) at ${label}`, () => {
    test.use({ viewport: vp });
    for (const route of ROUTES) {
      test(`no violations on ${route}`, async ({ page }) => {
        await prepare(page);
        await page.goto(route);
        await settle(page);
        expect(await scan(page)).toEqual([]);
      });
    }
  });
}

test.describe("structure and keyboard", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("every route has one h1, a main landmark, a language and a unique title", async ({ page }) => {
    await prepare(page);
    const titles = new Map<string, string>();
    for (const route of ROUTES.filter((r) => !r.includes("?") && !r.includes("does-not-exist"))) {
      await page.goto(route);
      await settle(page);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
      const title = await page.title();
      expect(title.length).toBeGreaterThan(3);
      if (titles.has(title)) throw new Error(`title "${title}" used by both ${titles.get(title)} and ${route}`);
      titles.set(title, route);
    }
  });
  test("skip link is the first stop and moves focus to main; focus is always visible", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
  });
  test("tabbing through the explorer reaches every control and never gets trapped", async ({ page }) => {
    test.setTimeout(60_000);   // 60 key presses against a live WebGL map in software rendering
    await prepare(page);
    await page.goto("/explore");
    await expect(page.getByRole("button", { name: "Junction fruit and sugarcane carts" })).toBeVisible();
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const d = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; if (!a || a === document.body) return "body"; const r = a.getBoundingClientRect(); return `${a.tagName}:${(a.getAttribute("aria-label") || (a as HTMLInputElement).labels?.[0]?.textContent || a.textContent || a.id || "").trim().slice(0, 30)}:${r.width > 0 && r.height > 0}`; });
      seen.add(d);
    }
    const names = [...seen].join(" | ");
    // names are cut to 30 characters above
    for (const must of ["Search places", "Heritage", "Junction fruit and sugarcane", "Explore"]) expect(names, must).toContain(must);
    expect([...seen].filter((s) => s.endsWith(":false")), "focus landed on an element with no size").toEqual([]);
    expect(seen.size).toBeGreaterThan(10);               // cycled through many distinct stops rather than being trapped in one
  });
  test("text can be enlarged: 200% text keeps content readable without sideways scrolling", async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = "200%"; }); });
    await page.setViewportSize({ width: 640, height: 800 });
    for (const route of ["/", "/explore", "/research/methodology", "/insights"]) {
      await page.goto(route);
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
    }
  });
  test("reduced motion: no running animations or transitions on the home page", async ({ page }) => {
    await prepare(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settle(page);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
  });
  test("forced colours / high contrast keeps focus indicators and controls visible", async ({ page }) => {
    await prepare(page);
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/explore");
    await page.getByRole("searchbox", { name: "Search places" }).focus();
    const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
  test("there is no language picker; the page is English, and display settings are one keypress away", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await expect(page.getByRole("combobox", { name: /language/i })).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.keyboard.press(",");
    await expect(page.getByRole("heading", { name: "Display and accessibility" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Contrast" }).getByRole("radio", { name: "High" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  });
});
