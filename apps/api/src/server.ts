import { loadServerEnv, redactEnv } from "@makarba/config";
import { createApp } from "./app.js";

const env = loadServerEnv(process.env);
createApp().listen(env.API_PORT, () => console.log("api listening", JSON.stringify(redactEnv(env))));
