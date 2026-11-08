import pg from "pg";
import { loadServerEnv, redactEnv, type ServerEnv } from "@makarba/config";
import { Authorizer, assertPolicyUsable, loadMatrix } from "@makarba/authz";
import type { Express } from "express";
import { createApp } from "./app.js";
import { safeRequestLogger } from "./logging.js";
import { PgPublicRepository } from "./pg-public-repository.js";
import { publicApi } from "./public-api.js";
import { notFound, safeErrors } from "./safe-errors.js";

export interface Prepared { app: Express; env: ServerEnv; publicPool: pg.Pool | null; logLine: string }

/**
 * Builds the API from raw environment variables or throws (issue #40). Fail closed: any invalid or unsafe configuration, or a
 * production start on a capability matrix that is not approved, stops start-up before a port is opened. Error messages name
 * variables, never values. The read-only public API gets its OWN connection string (READONLY_DATABASE_URL, role makarba_public_api);
 * without it the public API is not mounted.
 */
export function prepareServer(raw: Record<string, string | undefined>, log: (line: string) => void = console.log): Prepared {
  const env = loadServerEnv(raw);
  assertPolicyUsable(new Authorizer(loadMatrix()), env.APP_ENV);
  const app = createApp();
  app.use(safeRequestLogger(log));
  let publicPool: pg.Pool | null = null;
  if (env.READONLY_DATABASE_URL) {
    publicPool = new pg.Pool({ connectionString: env.READONLY_DATABASE_URL, max: 5, idleTimeoutMillis: 30_000, statement_timeout: 5_000 });
    app.use("/api/v1/public", publicApi({ repository: new PgPublicRepository(publicPool, { datasetKind: env.APP_ENV === "production" ? "approved" : "synthetic" }) }));
  }
  app.use(notFound);
  app.use(safeErrors);
  return { app, env, publicPool, logLine: `api listening ${JSON.stringify(redactEnv(env))} ${publicPool ? "public API mounted" : "public API NOT mounted (READONLY_DATABASE_URL unset)"}` };
}
