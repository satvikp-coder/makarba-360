import { loadMockEnv } from "@makarba/config";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";

const env = loadMockEnv(process.env);
const app = createApp();
// The API URL is printed alongside the web URL by the launcher. Make opening it useful.
const webPort = Number(process.env.WEB_PORT ?? "5173");
if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) throw new Error("WEB_PORT must be a valid TCP port");
app.get("/", (_req, res) => res.redirect(302, `http://localhost:${webPort}/`));
app.use("/api/v1/public", mockRouter());
app.listen(env.API_PORT, "127.0.0.1", () => console.log(`SYNTHETIC mock API listening on port ${env.API_PORT}; open the web app at http://localhost:${webPort}/`));
