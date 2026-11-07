import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemorySessionStore, SessionService, type OidcConfig } from "@makarba/auth";
import { authRouter, requireCsrf, requireSession } from "./auth-routes.js";

let server: Server;
let cfg: OidcConfig;
let key: CryptoKey;
let jwks: { keys: JWK[] };
let claimsFor: (nonce: string) => Record<string, unknown> = () => ({});
let pendingNonce = "";

const subjects: Record<string, { id: string; roles: string[] }> = {
  "sub-researcher": { id: "user-r", roles: ["researcher"] },
  "sub-lead": { id: "user-l", roles: ["lead"] },
};

function build() {
  const store = new MemorySessionStore();
  const sessions = new SessionService({ store });
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter({ oidc: cfg, sessions, secureCookies: true, users: { findActiveBySubject: async (s) => subjects[s] ?? null } }));
  app.post("/private/write", requireSession(sessions), requireCsrf(sessions), (_req, res) => res.json({ wrote: true }));
  app.get("/private/read", requireSession(sessions), (_req, res) => res.json({ read: true }));
  return { app, store };
}

async function signIn(app: express.Express, sub: string, amr: string[]) {
  const start = await request(app).get("/auth/login");
  expect(start.status).toBe(302);
  const loc = new URL(start.headers.location!);
  pendingNonce = loc.searchParams.get("nonce")!;
  const state = loc.searchParams.get("state")!;
  claimsFor = (nonce) => ({ iss: cfg.issuer, aud: cfg.clientId, sub, nonce, exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), amr });
  const loginCookie = (start.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("mk_login="))!.split(";")[0]!;
  return { state, loginCookie };
}

beforeAll(async () => {
  const kp = await generateKeyPair("RS256");
  key = kp.privateKey;
  jwks = { keys: [{ ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
  server = createServer((req, res) => {
    if (req.url === "/jwks") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(jwks)); return; }
    if (req.url === "/token") {
      req.resume();
      req.on("end", async () => {
        const jwt = await new SignJWT(claimsFor(pendingNonce)).setProtectedHeader({ alg: "RS256", kid: "k1" }).sign(key);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id_token: jwt }));
      });
      return;
    }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cfg = { issuer: "https://idp.synthetic.invalid", clientId: "makarba-test", redirectUri: "https://app.synthetic.invalid/auth/callback",
    authorizationEndpoint: `${base}/authorize`, tokenEndpoint: `${base}/token`, jwksUri: `${base}/jwks` };
});
afterAll(async () => { await new Promise((r) => server.close(r)); });

describe("auth routes", () => {
  it("denies private routes without a session", async () => {
    const { app } = build();
    expect((await request(app).get("/private/read")).status).toBe(401);
    expect((await request(app).post("/private/write")).status).toBe(401);
  });

  it("signs in a provisioned researcher, sets a hardened cookie, then logs out", async () => {
    const { app } = build();
    const { state, loginCookie } = await signIn(app, "sub-researcher", ["pwd"]);
    const cb = await request(app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie);
    expect(cb.status).toBe(200);
    const setCookies = cb.headers["set-cookie"] as unknown as string[];
    const sess = setCookies.find((c) => c.startsWith("mk_session="))!;
    expect(sess).toMatch(/HttpOnly/);
    expect(sess).toMatch(/Secure/);
    expect(sess).toMatch(/SameSite=Lax/);
    const cookie = sess.split(";")[0]!;
    const csrf = cb.body.csrfToken as string;
    expect((await request(app).get("/private/read").set("Cookie", cookie)).status).toBe(200);
    // CSRF: write without token is denied, with token allowed
    expect((await request(app).post("/private/write").set("Cookie", cookie)).status).toBe(403);
    expect((await request(app).post("/private/write").set("Cookie", cookie).set("x-csrf-token", "forged")).status).toBe(403);
    expect((await request(app).post("/private/write").set("Cookie", cookie).set("x-csrf-token", csrf)).status).toBe(200);
    // logout revokes immediately
    expect((await request(app).post("/auth/logout").set("Cookie", cookie).set("x-csrf-token", csrf)).status).toBe(200);
    expect((await request(app).get("/private/read").set("Cookie", cookie)).status).toBe(401);
  });

  it("denies a cross-site callback with a mismatched or missing state", async () => {
    const { app } = build();
    const { loginCookie } = await signIn(app, "sub-researcher", ["pwd"]);
    expect((await request(app).get("/auth/callback?code=c&state=attacker").set("Cookie", loginCookie)).status).toBe(400);
    expect((await request(app).get("/auth/callback?code=c&state=whatever")).status).toBe(400);
  });

  it("makes a pending login single-use", async () => {
    const { app } = build();
    const { state, loginCookie } = await signIn(app, "sub-researcher", ["pwd"]);
    expect((await request(app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie)).status).toBe(200);
    expect((await request(app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie)).status).toBe(400);
  });

  it("denies identities that are not provisioned (deny by default)", async () => {
    const { app, store } = build();
    const { state, loginCookie } = await signIn(app, "sub-stranger", ["pwd", "otp"]);
    const cb = await request(app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie);
    expect(cb.status).toBe(403);
    expect(cb.body.code).toBe("NOT_PROVISIONED");
    expect(store.sessions.size).toBe(0);
  });

  it("requires MFA for a lead (provisional policy) and accepts it with a second factor", async () => {
    const { app, store } = build();
    const weak = await signIn(app, "sub-lead", ["pwd"]);
    const denied = await request(app).get(`/auth/callback?code=c&state=${weak.state}`).set("Cookie", weak.loginCookie);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("MFA_REQUIRED");
    expect(store.sessions.size).toBe(0);
    const strong = await signIn(app, "sub-lead", ["pwd", "otp"]);
    expect((await request(app).get(`/auth/callback?code=c&state=${strong.state}`).set("Cookie", strong.loginCookie)).status).toBe(200);
    expect([...store.sessions.values()][0]!.mfa).toBe(true);
  });

  it("never reveals identity-provider internals in error bodies", async () => {
    const { app } = build();
    const { loginCookie } = await signIn(app, "sub-researcher", ["pwd"]);
    const r = await request(app).get("/auth/callback?code=c&state=attacker").set("Cookie", loginCookie);
    expect(JSON.stringify(r.body)).not.toMatch(/jwks|nonce|verifier|signature/i);
  });
});
