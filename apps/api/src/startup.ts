import pg from "pg";
import { loadServerEnv, redactEnv, type ServerEnv } from "@makarba/config";
import { Authorizer, assertPolicyUsable, loadMatrix } from "@makarba/authz";
import type { Express } from "express";
import { createApp } from "./app.js";
import { safeRequestLogger } from "./logging.js";
import { discoverOidc, mountPrivateStack } from "./private-stack.js";
import { PgPublicRepository } from "./pg-public-repository.js";
import { publicApi } from "./public-api.js";
import { notFound, safeErrors } from "./safe-errors.js";

export interface Prepared { app: Express; env: ServerEnv; publicPool: pg.Pool | null; privatePool: pg.Pool | null; logLine: string }

/**
 * Builds the API from raw environment variables or throws (issue #40). Fail closed: any invalid or unsafe configuration, or a
 * production start on a capability matrix that is not approved, stops start-up before a port is opened. Error messages name
 * variables, never values. The read-only public API gets its OWN connection string (READONLY_DATABASE_URL, role makarba_public_api);
 * without it the public API is not mounted.
 */
export interface PrepareOptions { log?: (line: string) => void; fetchImpl?: typeof fetch; allowInsecureOidc?: boolean; poolFactory?: (connectionString: string) => pg.Pool }

export async function prepareServer(raw: Record<string, string | undefined>, opts: PrepareOptions = {}): Promise<Prepared> {
  const log = opts.log ?? console.log;
  const makePool = opts.poolFactory ?? ((cs: string) => new pg.Pool({ connectionString: cs, max: 10, idleTimeoutMillis: 30_000, statement_timeout: 10_000 }));
  const env = loadServerEnv(raw);
  assertPolicyUsable(new Authorizer(loadMatrix()), env.APP_ENV);
  const app = createApp();
  app.use(safeRequestLogger(log));
  let publicPool: pg.Pool | null = null;
  if (env.READONLY_DATABASE_URL) {
    publicPool = makePool(env.READONLY_DATABASE_URL);
    app.use("/api/v1/public", publicApi({ repository: new PgPublicRepository(publicPool, { datasetKind: env.APP_ENV === "production" ? "approved" : "synthetic" }) }));
  }
  let privatePool: pg.Pool | null = null;
  if (env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_REDIRECT_URI) {
    // Private API (sessions, invitations, capability-checked routes). Needs the identity provider; without OIDC_* it is not mounted.
    const oidc = await discoverOidc({ issuer: env.OIDC_ISSUER, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, redirectUri: env.OIDC_REDIRECT_URI }, opts.fetchImpl, opts.allowInsecureOidc);
    privatePool = makePool(env.DATABASE_URL);
    mountPrivateStack(app, { pool: privatePool, authz: new Authorizer(loadMatrix()), oidc, secureCookies: env.APP_ENV !== "local", fetchImpl: opts.fetchImpl });
  }
  app.use(notFound);
  app.use(safeErrors);
  return {
    app, env, publicPool, privatePool,
    logLine: `api listening ${JSON.stringify(redactEnv(env))} ${publicPool ? "public API mounted" : "public API NOT mounted (READONLY_DATABASE_URL unset)"}; ${privatePool ? "private API mounted" : "private API NOT mounted (OIDC_* unset)"}`,
  };
}
