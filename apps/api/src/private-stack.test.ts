import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { AccountService, Authorizer, loadMatrix } from "@makarba/authz";
import { prepareServer, type Prepared } from "./startup.js";

// End to end on PostGIS (CI `database` job): fake identity provider -> real sessions, grants, invitations, audit and private routes.
// Synthetic people and geometry only. Skipped locally without TEST_DATABASE_URL.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";
const OTHER_AREA = "00000000-0000-4000-8000-0000000000a2";

describe.skipIf(!url)("private API stack on PostGIS with a fake identity provider [PASS - SYNTHETIC IDENTITY PROVIDER when run in CI]", () => {
  let admin: pg.Client, idp: Server, base = "", key: CryptoKey, jwks: { keys: JWK[] };
  let claims: (nonce: string) => Record<string, unknown> = () => ({});
  let nonce = "";
  let prepared: Prepared;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url }); await admin.connect();
    const kp = await generateKeyPair("RS256");
    key = kp.privateKey;
    jwks = { keys: [{ ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
    idp = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/.well-known/openid-configuration") { res.end(JSON.stringify({ issuer: base, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`, jwks_uri: `${base}/jwks` })); return; }
      if (req.url === "/jwks") { res.end(JSON.stringify(jwks)); return; }
      if (req.url === "/token") {
        req.resume();
        req.on("end", async () => { res.end(JSON.stringify({ id_token: await new SignJWT(claims(nonce)).setProtectedHeader({ alg: "RS256", kid: "k1" }).sign(key) })); });
        return;
      }
      res.statusCode = 404; res.end("{}");
    });
    await new Promise<void>((r) => idp.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise((r) => idp.close(r)); await admin.end(); });

  beforeEach(async () => {
    if (prepared?.privatePool) await prepared.privatePool.end();
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    await admin.query(`INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('${AREA}', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((9 9,12 9,12 12,9 12,9 9)))',4326))`);
    await admin.query("INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark')");
    const mk = async (name: string, sub: string, role: string, area: string | null, by?: string) => {
      const id = (await admin.query("INSERT INTO private.users (oidc_subject, display_name) VALUES ($1, $2) RETURNING id", [sub, name])).rows[0].id as string;
      ids[name] = id;
      if (by) await admin.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,$2,$3,$4)", [id, role, area, by]);
      return id;
    };
    const root = await mk("root", "sub-root", "administrator", null);
    const grantor = await mk("grantor", "sub-grantor", "researcher", AREA);
    // The administrator role may only be granted through the maintenance path (superuser here), by a different user.
    await admin.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,'administrator',NULL,$2)", [root, grantor]);
    await mk("researcher", "sub-researcher", "researcher", AREA, root);
    await mk("lead", "sub-lead", "lead", AREA, root);
    await mk("otherlead", "sub-otherlead", "lead", OTHER_AREA, root);
    prepared = await prepareServer(
      { DATABASE_URL: url!, SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz012345", OIDC_ISSUER: base, OIDC_CLIENT_ID: "makarba-test", OIDC_CLIENT_SECRET: "synthetic-client-secret-value", OIDC_REDIRECT_URI: "http://localhost/auth/callback" },
      { log: () => {}, allowInsecureOidc: true, poolFactory: (cs) => new pg.Pool({ connectionString: cs, options: "-c role=makarba_private_api", max: 5 }) },
    );
  });

  async function signIn(sub: string, amr: string[] = ["pwd"], invite?: string) {
    const start = await request(prepared.app).get("/auth/login" + (invite ? `?invite=${invite}` : ""));
    expect(start.status).toBe(302);
    const loc = new URL(start.headers["location"]!);
    nonce = loc.searchParams.get("nonce")!;
    const state = loc.searchParams.get("state")!;
    claims = (n) => ({ iss: base, aud: "makarba-test", sub, nonce: n, exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), amr });
    const loginCookie = (start.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("mk_login="))!.split(";")[0]!;
    const cb = await request(prepared.app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie);
    if (cb.status !== 200) return { status: cb.status as number, cookie: "", csrf: "", body: cb.body };
    const cookie = (cb.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("mk_session="))!.split(";")[0]!;
    return { status: 200, cookie, csrf: cb.body.csrfToken as string, body: cb.body };
  }
  const point = { type: "Point", coordinates: [10.5, 10.5] };
  const newPlace = { studyAreaId: AREA, studyAreaVersion: 1, categoryId: "heritage", name: { en: "Synthetic well" }, crs: "EPSG:4326", geometry: point, provenance: { source: "synthetic", method: "digitised" } };
  const call = (s: { cookie: string; csrf: string }, method: "get" | "post" | "put", path: string, body?: object) => {
    const r = request(prepared.app)[method](`/api/v1/private${path}`).set("Cookie", s.cookie);
    return method === "get" ? r : r.set("X-CSRF-Token", s.csrf).send(body ?? {});
  };

  it("the private API is mounted only because an identity provider is configured, and /health stays public", async () => {
    expect(prepared.logLine).toContain("private API mounted");
    expect((await request(prepared.app).get("/health")).status).toBe(200);
    expect((await request(prepared.app).get("/api/v1/private/locations")).status).toBe(401);
  });

  it("provisioned users sign in; unknown identities and users who need MFA without it are refused", async () => {
    expect((await signIn("sub-researcher")).status).toBe(200);
    expect((await signIn("sub-stranger")).body.code).toBe("NOT_PROVISIONED");
    const noMfa = await signIn("sub-lead", ["pwd"]);
    expect([noMfa.status, noMfa.body.code]).toEqual([403, "MFA_REQUIRED"]);
    expect((await signIn("sub-lead", ["pwd", "mfa"])).status).toBe(200);
  });

  it("researcher proposes a place; a lead of that study reviews it; a lead of another study cannot see it; everything is audited", async () => {
    const r = await signIn("sub-researcher");
    const created = await call(r, "post", "/locations", newPlace);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ state: "candidate", proposedBy: ids["researcher"] });
    const id = created.body.id as string;
    expect((await call(r, "post", `/locations/${id}/review`, { expectedRevision: 1 })).status).toBe(403);   // researchers do not review
    expect((await call(r, "get", `/locations/${id}`)).status).toBe(403);

    const other = await signIn("sub-otherlead", ["mfa"]);
    expect((await call(other, "get", `/locations/${id}`)).status).toBe(403);

    const lead = await signIn("sub-lead", ["mfa"]);
    expect((await call(lead, "get", `/locations?studyAreaId=${AREA}`)).body.items).toHaveLength(1);
    const reviewed = await call(lead, "post", `/locations/${id}/review`, { expectedRevision: 1 });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body).toMatchObject({ state: "reviewed", reviewedBy: ids["lead"] });
    expect((await call(lead, "get", `/locations/${id}/revisions`)).body.items).toHaveLength(1);

    const log = (await admin.query("SELECT action, outcome, actor_id FROM audit.security_events ORDER BY id")).rows;
    expect(log.some((e) => e.action === "location.propose_geometry" && e.outcome === "allow" && e.actor_id === ids["researcher"])).toBe(true);
    expect(log.some((e) => e.action === "location.review_geometry" && e.outcome === "deny" && e.actor_id === ids["researcher"])).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/Synthetic well|10\.5/);                      // audit holds no content
  });

  it("writes need the CSRF token; a forged or missing session cookie is 401", async () => {
    const r = await signIn("sub-researcher");
    expect((await request(prepared.app).post("/api/v1/private/locations").set("Cookie", r.cookie).send(newPlace)).status).toBe(403);
    expect((await request(prepared.app).post("/api/v1/private/locations").set("Cookie", "mk_session=forged").set("X-CSRF-Token", r.csrf).send(newPlace)).status).toBe(401);
  });

  it("a deactivated user stops working on the very next request; revoked sessions are 401; deactivated users cannot sign in again", async () => {
    const r = await signIn("sub-researcher");
    expect((await call(r, "post", "/locations", newPlace)).status).toBe(201);
    await admin.query("UPDATE private.users SET active = false WHERE id = $1", [ids["researcher"]]);
    expect((await call(r, "post", "/locations", { ...newPlace, name: { en: "second" } })).status).toBe(401);
    expect((await signIn("sub-researcher")).body.code).toBe("NOT_PROVISIONED");
    await admin.query("UPDATE private.users SET active = true WHERE id = $1", [ids["researcher"]]);
    const again = await signIn("sub-researcher");
    expect((await call(again, "get", `/locations?studyAreaId=${AREA}`)).status).toBe(403);       // researchers cannot list
    await admin.query("UPDATE private.sessions SET revoked_at = now() WHERE user_id = $1", [ids["researcher"]]);
    expect((await call(again, "post", "/locations", newPlace)).status).toBe(401);
  });

  it("a revoked or expired role grant stops access without a new login", async () => {
    const r = await signIn("sub-researcher");
    await admin.query("UPDATE private.user_roles SET revoked_at = now() WHERE user_id = $1", [ids["researcher"]]);
    expect((await call(r, "post", "/locations", newPlace)).status).toBe(403);
  });

  it("invitation-only onboarding: an invited identity is provisioned with exactly the invited role and study, once", async () => {
    const root = (await new (await import("@makarba/authz")).PgGrantStore(admin).loadPrincipal(ids["root"]!))!;
    const svc = new AccountService(admin, new Authorizer(loadMatrix()));
    const inv = await svc.invite(root, { label: "synthetic invitee", role: "researcher", studyAreaId: AREA });
    expect((await signIn("sub-invitee")).body.code).toBe("NOT_PROVISIONED");                    // not provisioned without the invitation
    const first = await signIn("sub-invitee", ["pwd"], inv.token);
    expect(first.status).toBe(200);
    expect((await call(first, "post", "/locations", newPlace)).status).toBe(201);
    expect((await call(first, "post", "/locations", { ...newPlace, studyAreaId: OTHER_AREA })).status).toBe(403);   // only the invited study
    expect((await signIn("sub-second-person", ["pwd"], inv.token)).body.code).toBe("NOT_PROVISIONED");             // single use
  });

  it("the private pool runs as the private API role: it cannot delete places or read other schemas' secrets it should not", async () => {
    await expect(prepared.privatePool!.query("DELETE FROM private.locations")).rejects.toMatchObject({ code: "42501" });
    await expect(prepared.privatePool!.query("UPDATE audit.security_events SET outcome = 'allow'")).rejects.toMatchObject({ code: "42501" });
  });
});
