import { loadMockEnv } from "@makarba/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";

const env = loadMockEnv(process.env);
const app = createApp();
// The API URL is printed alongside the web URL by the launcher. Make opening it useful.
const webPort = Number(process.env.WEB_PORT ?? "5173");
if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) throw new Error("WEB_PORT must be a valid TCP port");
if (!process.env.WEB_DIST) app.get("/", (_req, res) => res.redirect(302, `http://localhost:${webPort}/`));
app.use("/api/v1/public", mockRouter());
// Hosted demo (Render): serve the built web app from the same origin so no proxy or CORS is needed. Set WEB_DIST to apps/web/dist.
const dist = process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : undefined;
if (dist && existsSync(dist)) {
  // the same security headers the nginx tier sends (deploy/headers.json); Render serves over HTTPS, so HSTS applies too
  const h = JSON.parse(readFileSync(new URL("../../../deploy/headers.json", import.meta.url), "utf8")) as { headers: Record<string, string>; httpsOnly: Record<string, string> };
  const security = { ...h.headers, ...h.httpsOnly };
  app.use((_req, res, next) => { res.set(security); next(); });
  // hashed build files never change; everything else (index.html, data JSON) is revalidated
  app.use(express.static(dist, { setHeaders: (res, path) => res.setHeader("Cache-Control", /[\\/]assets[\\/]/.test(path) ? "public, max-age=31536000, immutable" : "no-cache") }));
  // client-side routes only: a missing file or API path is a real 404, never the app page
  app.get(/^(?!\/api\/)[^.]*$/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}
app.listen(env.API_PORT, process.env.MOCK_API_HOST ?? "127.0.0.1", () => console.log(`SYNTHETIC mock API listening on port ${env.API_PORT}; open the web app at http://localhost:${webPort}/`));
