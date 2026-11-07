import { loadMockEnv } from "@makarba/config";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";

const env = loadMockEnv(process.env);
const app = createApp();
app.use("/api/v1/public", mockRouter());
app.listen(env.API_PORT, "127.0.0.1", () => console.log(`SYNTHETIC mock public API on http://127.0.0.1:${env.API_PORT}`));
