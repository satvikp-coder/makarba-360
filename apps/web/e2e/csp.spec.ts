import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Serves the PRODUCTION BUILD with exactly the security headers in deploy/headers.json (what nginx must send) and proves the site works
// under them in a real browser: map and worker, panorama viewer, gallery, search. Needs `pnpm build` first (CI browser job does it).
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const HEADERS = JSON.parse(readFileSync(fileURLToPath(new URL("../../../deploy/headers.json", import.meta.url)), "utf8")).headers as Record<string, string>;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let server: Server;
let base = "";

test.skip(!existsSync(join(DIST, "index.html")), "apps/web/dist is missing: run pnpm --filter @makarba/web build first");

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const send = (status: number, body: Buffer | string, type: string, extra: Record<string, string> = {}) => res.writeHead(status, { ...HEADERS, "content-type": type, "cache-control": "no-store", ...extra }).end(body);
    if (url.pathname.startsWith("/api/")) {
      const up = await fetch(`http://127.0.0.1:${process.env.MOCK_API_PORT ?? "4010"}` + url.pathname + url.search, { method: req.method }).catch(() => null);
      return up ? send(up.status, Buffer.from(await up.arrayBuffer()), up.headers.get("content-type") ?? "application/json") : send(502, "{}", "application/json");
    }
    const file = join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
    if (file.startsWith(DIST) && existsSync(file) && !file.endsWith("\\") && !file.endsWith("/")) {
      try { return send(200, await readFile(file), TYPES[extname(file)] ?? "application/octet-stream"); } catch { /* directory */ }
    }
    return send(200, await readFile(join(DIST, "index.html")), "text/html");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

test("the production build works under the required security headers (map, worker, search, panorama, gallery)", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  page.on("pageerror", (e) => violations.push(String(e)));
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.route(/example\.invalid/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG, headers: { "access-control-allow-origin": "*" } }));

  await page.goto(base + "/explore");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("searchbox", { name: "Search places" }).fill("canal");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/1 place matches/)).toBeVisible();

  await page.goto(base + "/places/junction-fruit-carts");
  await expect(page.getByRole("heading", { level: 1, name: "Junction fruit and sugarcane carts" })).toBeVisible();
  const open = page.getByRole("button", { name: "Explore in 360°" });
  await open.scrollIntoViewIfNeeded();
  await open.click();
  // either the viewer starts or a clear message appears; a blocked script or worker would show a CSP violation below
  await expect(page.locator(".pnlm-container canvas, [role=status]").first()).toBeVisible({ timeout: 20_000 });

  // The frozen synthetic fixture hosts its panorama on https://example.invalid/, which this policy rightly refuses to fetch
  // (connect-src). Whether the viewer reaches that fetch before the check above is a timing race, so the outcome is made explicit:
  // that one placeholder request (and the viewer's follow-on error) is expected and must end in the clear message for the visitor.
  // Every other violation - our scripts, worker, styles, images - still fails the test. The policy itself is not loosened.
  const placeholder = (v: string) => /example\.invalid\/public\/synthetic-panorama/.test(v) || /readAsBinaryString/.test(v);
  if (violations.some(placeholder)) await expect(page.getByText(/could not be loaded/)).toBeVisible({ timeout: 15_000 });
  expect(violations.filter((v) => !placeholder(v)), violations.join("\n")).toEqual([]);
});

test("the headers are really on the response, including for deep links", async ({ request }) => {
  for (const path of ["/", "/explore", "/places/junction-fruit-carts"]) {
    const r = await request.get(base + path);
    for (const [k, v] of Object.entries(HEADERS)) expect(r.headers()[k.toLowerCase()], `${path} ${k}`).toBe(v);
  }
});
