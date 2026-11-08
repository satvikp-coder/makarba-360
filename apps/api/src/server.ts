import pg from "pg";
import { loadServerEnv, redactEnv } from "@makarba/config";
import { Authorizer, assertPolicyUsable, loadMatrix } from "@makarba/authz";
import { createApp } from "./app.js";
import { safeRequestLogger } from "./logging.js";
import { PgPublicRepository } from "./pg-public-repository.js";
import { publicApi } from "./public-api.js";
import { notFound, safeErrors } from "./safe-errors.js";

const env = loadServerEnv(process.env);
// Production must never run on a capability matrix that stakeholders have not approved (issue #6).
assertPolicyUsable(new Authorizer(loadMatrix()), env.APP_ENV);
const app = createApp();
app.use(safeRequestLogger());

// Public read-only API (issue #81). It uses its OWN connection string for the `makarba_public_api` role (SELECT on `published` only),
// never DATABASE_URL, so a bug here cannot read private tables. Without PUBLIC_DATABASE_URL it is simply not mounted.
let publicPool: pg.Pool | null = null;
if (process.env["PUBLIC_DATABASE_URL"]) {
  publicPool = new pg.Pool({ connectionString: process.env["PUBLIC_DATABASE_URL"], max: 5, idleTimeoutMillis: 30_000, statement_timeout: 5_000 });
  app.use("/api/v1/public", publicApi({ repository: new PgPublicRepository(publicPool, { datasetKind: env.APP_ENV === "production" ? "approved" : "synthetic" }) }));
}

// Always last: plain JSON errors, never a stack trace or file path (threat register AC-09).
app.use(notFound);
app.use(safeErrors);

const server = app.listen(env.API_PORT, () => console.log("api listening", JSON.stringify(redactEnv(env)), publicPool ? "public API mounted" : "public API NOT mounted (PUBLIC_DATABASE_URL unset)"));

// Graceful shutdown: stop accepting connections, let in-flight requests finish, close the pool, exit; force-exit after 10 s.
let closing = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (closing) return;
    closing = true;
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => { void (publicPool?.end() ?? Promise.resolve()).finally(() => process.exit(0)); });
  });
}
