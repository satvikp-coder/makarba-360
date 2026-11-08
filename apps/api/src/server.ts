import { prepareServer } from "./startup.js";

let prepared;
try {
  prepared = await prepareServer(process.env);
} catch (e) {
  // Message names variables only (never values); no stack trace is printed.
  console.error(`startup refused: ${e instanceof Error ? e.message : "invalid configuration"}`);
  process.exit(1);
}
const { app, env, publicPool, privatePool, logLine } = prepared;
const server = app.listen(env.API_PORT, () => console.log(logLine));

// Graceful shutdown: stop accepting connections, let in-flight requests finish, close the pool, exit; force-exit after 10 s.
let closing = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (closing) return;
    closing = true;
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => { void Promise.all([publicPool?.end(), privatePool?.end()]).finally(() => process.exit(0)); });
  });
}
