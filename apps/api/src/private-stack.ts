import type pg from "pg";
import express, { type Express } from "express";
import { PgSessionStore, SessionService, type OidcConfig } from "@makarba/auth";
import { AccountService, PgGrantStore, type Authorizer } from "@makarba/authz";
import { failSafe, PgAuditSink } from "@makarba/audit";
import { authRouter, type InvitationRedeemer, type UserDirectory } from "./auth-routes.js";
import { PgLocationRepository } from "./location-repository.js";
import { PgConsentRepository } from "./consent-repository.js";
import { consentRoutes } from "./consent-routes.js";
import { locationRoutes } from "./location-routes.js";
import { privateApi } from "./private-routes.js";

/** Fetches and checks the provider's discovery document. https only (loopback http only when allowInsecure, for tests); issuer must match exactly. */
export async function discoverOidc(
  o: { issuer: string; clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
  allowInsecure = false,
): Promise<OidcConfig> {
  const base = o.issuer.replace(/\/$/, "");
  const res = await fetchImpl(`${base}/.well-known/openid-configuration`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`OIDC discovery failed (status ${res.status})`);
  const d = (await res.json()) as Record<string, unknown>;
  if (typeof d["issuer"] !== "string" || d["issuer"].replace(/\/$/, "") !== base) throw new Error("OIDC discovery: issuer in the document does not match OIDC_ISSUER");
  const endpoint = (name: string) => {
    const v = d[name];
    if (typeof v !== "string" || !(v.startsWith("https://") || (allowInsecure && v.startsWith("http://")))) throw new Error(`OIDC discovery: ${name} missing or not https`);
    return v;
  };
  return {
    issuer: d["issuer"], clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri,
    authorizationEndpoint: endpoint("authorization_endpoint"), tokenEndpoint: endpoint("token_endpoint"), jwksUri: endpoint("jwks_uri"),
  };
}

/** Only provisioned, active users may sign in; roles are the user's current non-revoked, unexpired grants. */
export class PgUserDirectory implements UserDirectory {
  constructor(private db: pg.Pool) {}
  async findActiveBySubject(sub: string) {
    const u = await this.db.query("SELECT id FROM private.users WHERE oidc_subject = $1 AND active", [sub]);
    if (!u.rows[0]) return null;
    const id = u.rows[0]["id"] as string;
    const r = await this.db.query("SELECT DISTINCT role_id FROM private.user_roles WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())", [id]);
    return { id, roles: r.rows.map((x) => x["role_id"] as string) };
  }
}

/** Invitation redemption is a transaction, so it runs on its own checked-out connection. */
export class PgInvitationRedeemer implements InvitationRedeemer {
  constructor(private pool: pg.Pool, private authz: Authorizer) {}
  async accept(token: string, oidcSubject: string, displayName: string) {
    const c = await this.pool.connect();
    try { await new AccountService(c, this.authz).acceptInvitation(token, oidcSubject, displayName); } finally { c.release(); }
  }
}

export interface PrivateStackOptions {
  pool: pg.Pool; authz: Authorizer; oidc: OidcConfig; secureCookies: boolean; fetchImpl?: typeof fetch; onAuditError?: (e: unknown) => void;
}

/** Mounts /auth and /api/v1/private. Every private route is authenticated, CSRF-protected and capability-checked; every decision is audited. */
export function mountPrivateStack(app: Express, o: PrivateStackOptions): SessionService {
  const sessions = new SessionService({ store: new PgSessionStore(o.pool) });
  const grants = new PgGrantStore(o.pool);
  const onError = o.onAuditError ?? (() => console.error("audit write failed"));
  const audit = { sink: failSafe(new PgAuditSink(o.pool), onError), onError };
  const json = express.json({ limit: "100kb" });
  app.use("/auth", json, authRouter({
    oidc: o.oidc, sessions, secureCookies: o.secureCookies, fetchImpl: o.fetchImpl,
    users: new PgUserDirectory(o.pool), invitations: new PgInvitationRedeemer(o.pool, o.authz),
  }));
  app.use("/api/v1/private", json, privateApi({ authz: o.authz, principals: grants, sessions, routes: [...locationRoutes(new PgLocationRepository(o.pool)), ...consentRoutes(new PgConsentRepository(o.pool))], audit }));
  return sessions;
}
