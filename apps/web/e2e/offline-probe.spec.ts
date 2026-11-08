import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Validates the offline probe tool itself (#54) in headless Chromium on localhost. This is NOT device evidence: the point is that
// the probe runs, reports honestly and can be handed to a person with a real phone.
const ROOT = fileURLToPath(new URL("../../../tools/offline-probe/", import.meta.url));
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
let server: Server;
let base = "";

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const p = normalize(new URL(req.url ?? "/", "http://x").pathname).split(/[\\/]+/).filter((seg) => seg !== ".." && seg !== "").join("/");
    const file = join(ROOT, p === "" ? "index.html" : p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const b = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(b); } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

type R = { id: string; status: string; detail: string };
const run = async (page: import("@playwright/test").Page): Promise<R[]> => {
  await page.getByRole("button", { name: "Run all checks" }).click();
  await page.waitForFunction(() => (window as unknown as { __probeResults?: unknown[] }).__probeResults?.length === 11, undefined, { timeout: 60_000 });
  return page.evaluate(() => (window as unknown as { __probeResults: R[] }).__probeResults);
};
const by = (r: R[], id: string) => r.find((x) => x.id === id)!;

test("probe runs, nothing fails, vault rejects wrong passphrase and tampering, unencrypted storage is not called safe", async ({ page }) => {
  await page.goto(base);
  await expect(page.locator("#ctx")).toContainText("Secure context");
  const r = await run(page);
  expect(r.filter((x) => x.status === "fail"), JSON.stringify(r.filter((x) => x.status === "fail"))).toEqual([]);
  expect(by(r, "features").status).toBe("pass");
  expect(by(r, "idb").status).toBe("pass");
  expect(by(r, "vault").status).toBe("pass");
  expect(by(r, "vault").detail).toContain("wrong passphrase rejected: true");
  expect(by(r, "vault").detail).toContain("tampered ciphertext rejected: true");
  expect(by(r, "plaintext").detail).toMatch(/not encrypted by the browser: unencrypted storage must never be called safe/);
  expect(by(r, "keystore").status).toBe("info");
  expect(by(r, "recovery").status).toBe("manual");
  expect(by(r, "pbkdf2").detail).toMatch(/100000: \d+ ms; 310000: \d+ ms; 600000: \d+ ms/);
});

test("after a reload the stored key still decrypts and the draft marker is found", async ({ page }) => {
  await page.goto(base);
  await run(page);
  await page.reload();
  const r = await run(page);
  expect(by(r, "keystore")).toMatchObject({ status: "pass" });
  expect(by(r, "keystore").detail).toContain("extractable: false");
  expect(by(r, "recovery").status).toBe("pass");
});

test("the downloaded report records the device, the manual steps and the limits, and contains no participant data", async ({ page }) => {
  await page.goto(base);
  await run(page);
  await page.getByLabel(/Notes/).fill("Desktop Chromium, harness check only");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download report (JSON)" }).click()]);
  const rep = JSON.parse(await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8"));
  expect(rep).toMatchObject({ probe: "makarba-offline-probe", issue: 54, syntheticDataOnly: true, notes: "Desktop Chromium, harness check only" });
  expect(rep.userAgent).toMatch(/Chrome|HeadlessChrome/);
  expect(rep.summary).toMatchObject({ total: 11, fail: 0 });
  expect(rep.interpretation).toMatch(/real device/);
  expect(JSON.stringify(rep)).not.toMatch(/latitude|longitude|participant record\b(?!")/i);
});

test("offline reload is served by the service worker cache", async ({ page, context }) => {
  await page.goto(base);
  await run(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
  await page.reload();                                 // lets the worker take control and cache the shell
  await page.waitForFunction(async () => (await caches.keys()).length > 0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline probe" })).toBeVisible();
  await expect(page.locator("#sw-line")).toContainText("served from the service worker cache");
  await context.setOffline(false);
});

test("Clear probe data removes the stored key and marker", async ({ page }) => {
  await page.goto(base);
  await run(page);
  await page.getByRole("button", { name: "Clear probe data" }).click();
  await page.reload();
  const r = await run(page);
  expect(by(r, "keystore").status).toBe("info");     // a new key was created, so the old one is gone
  expect(by(r, "recovery").status).toBe("manual");
});
