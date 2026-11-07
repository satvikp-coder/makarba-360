import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuthError, beginLogin, completeLogin, MemorySessionStore, mfaRequiredForRoles, mfaSatisfied, SessionService, sha256,
  type OidcConfig, type PendingLogin,
} from "./index.js";

// ---------- sessions ----------
describe("SessionService", () => {
  const setup = (opts: { idleMs?: number; absoluteMs?: number } = {}) => {
    let t = 1_000_000;
    const store = new MemorySessionStore();
    const svc = new SessionService({ store, now: () => new Date(t), ...opts });
    return { store, svc, advance: (ms: number) => { t += ms; } };
  };

  it("creates opaque sessions and stores only hashes", async () => {
    const { svc, store } = setup();
    const { token, csrfToken } = await svc.create("u1", true);
    expect(token.length).toBeGreaterThanOrEqual(43);
    const stored = JSON.stringify([...store.sessions.values()]);
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(csrfToken);
    expect(store.sessions.has(sha256(token))).toBe(true);
  });

  it("validates a live session and rejects unknown tokens", async () => {
    const { svc } = setup();
    const { token } = await svc.create("u1", false);
    expect(await svc.validate(token)).toMatchObject({ ok: true, session: { userId: "u1", mfa: false } });
    expect(await svc.validate("nope")).toEqual({ ok: false, reason: "unknown" });
    expect(await svc.validate(undefined)).toEqual({ ok: false, reason: "unknown" });
  });

  it("expires after the idle timeout, but activity extends it", async () => {
    const { svc, advance } = setup({ idleMs: 1000, absoluteMs: 100_000 });
    const { token } = await svc.create("u1", false);
    advance(900);
    expect((await svc.validate(token)).ok).toBe(true);
    advance(900); // 900ms since last activity: still fine
    expect((await svc.validate(token)).ok).toBe(true);
    advance(1000);
    expect(await svc.validate(token)).toEqual({ ok: false, reason: "idle_expired" });
  });

  it("expires at the absolute lifetime even with constant activity", async () => {
    const { svc, advance } = setup({ idleMs: 1000, absoluteMs: 2500 });
    const { token } = await svc.create("u1", false);
    advance(900); expect((await svc.validate(token)).ok).toBe(true);
    advance(900); expect((await svc.validate(token)).ok).toBe(true);
    advance(900);
    expect(await svc.validate(token)).toEqual({ ok: false, reason: "absolute_expired" });
  });

  it("logout revokes, and revocation is immediate for every session of a user", async () => {
    const { svc } = setup();
    const a = await svc.create("u1", false);
    const b = await svc.create("u1", false);
    const other = await svc.create("u2", false);
    await svc.logout(a.token);
    expect(await svc.validate(a.token)).toEqual({ ok: false, reason: "revoked" });
    expect(await svc.revokeUser("u1")).toBe(1);
    expect(await svc.validate(b.token)).toEqual({ ok: false, reason: "revoked" });
    expect((await svc.validate(other.token)).ok).toBe(true);
  });

  it("denies sessions of a deactivated user", async () => {
    const { svc, store } = setup();
    const { token } = await svc.create("u1", false);
    store.inactiveUsers.add("u1");
    expect(await svc.validate(token)).toEqual({ ok: false, reason: "user_inactive" });
  });

  it("checks CSRF tokens", async () => {
    const { svc } = setup();
    const { token, csrfToken } = await svc.create("u1", false);
    const v = await svc.validate(token);
    if (!v.ok) throw new Error("expected valid");
    expect(svc.csrfValid(v.session, csrfToken)).toBe(true);
    expect(svc.csrfValid(v.session, "forged")).toBe(false);
    expect(svc.csrfValid(v.session, undefined)).toBe(false);
  });
});

// ---------- OIDC against an in-process mock provider ----------
describe("OIDC login (mock provider)", () => {
  let server: Server;
  let cfg: OidcConfig;
  let jwks: { keys: JWK[] };
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  let nextClaims: Record<string, unknown> = {};
  let lastTokenBody = "";
  let tokenStatus = 200;

  const sign = (claims: Record<string, unknown>, key = privateKey, kid = "k1") =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid }).sign(key);

  beforeAll(async () => {
    const kp = await generateKeyPair("RS256");
    privateKey = kp.privateKey;
    otherKey = (await generateKeyPair("RS256")).privateKey;
    jwks = { keys: [{ ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
    server = createServer((req, res) => {
      if (req.url === "/jwks") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(jwks)); return; }
      if (req.url === "/token" && req.method === "POST") {
        let b = "";
        req.on("data", (d) => (b += d));
        req.on("end", async () => {
          lastTokenBody = b;
          if (tokenStatus !== 200) { res.statusCode = tokenStatus; res.end("{}"); return; }
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id_token: await sign(nextClaims) }));
        });
        return;
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    cfg = {
      issuer: "https://idp.synthetic.invalid", clientId: "makarba-test", redirectUri: "https://app.synthetic.invalid/auth/callback",
      authorizationEndpoint: `${base}/authorize`, tokenEndpoint: `${base}/token`, jwksUri: `${base}/jwks`,
    };
  });
  afterAll(async () => { await new Promise((r) => server.close(r)); });

  const claims = (pending: PendingLogin, over: Record<string, unknown> = {}) => ({
    iss: cfg.issuer, aud: cfg.clientId, sub: "synthetic-subject-1", name: "Synthetic Researcher", nonce: pending.nonce,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, amr: ["pwd", "otp"], ...over,
  });
  const login = (over: Record<string, unknown> = {}) => {
    const { url, pending } = beginLogin(cfg);
    nextClaims = claims(pending, over);
    return { url, pending };
  };

  it("builds an authorization request with PKCE S256, state and nonce", () => {
    const { url, pending } = beginLogin(cfg);
    const p = new URL(url).searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("code_challenge")).toBe(createHash("sha256").update(pending.codeVerifier).digest("base64url"));
    expect(p.get("state")).toBe(pending.state);
    expect(p.get("nonce")).toBe(pending.nonce);
    expect(url).not.toContain(pending.codeVerifier);
  });

  it("completes a valid login and sends the PKCE verifier to the token endpoint", async () => {
    const { pending } = login();
    const id = await completeLogin(cfg, pending, { code: "c", state: pending.state });
    expect(id.sub).toBe("synthetic-subject-1");
    expect(mfaSatisfied(id)).toBe(true);
    expect(new URLSearchParams(lastTokenBody).get("code_verifier")).toBe(pending.codeVerifier);
  });

  const failure = async (p: Promise<unknown>, code: AuthError["code"]) => {
    await expect(p).rejects.toBeInstanceOf(AuthError);
    await expect(p).rejects.toMatchObject({ code });
  };

  it("denies a cross-site login whose state does not match", async () => {
    const { pending } = login();
    await failure(completeLogin(cfg, pending, { code: "c", state: "attacker-state" }), "state_mismatch");
    await failure(completeLogin(cfg, undefined, { code: "c", state: pending.state }), "state_mismatch");
    await failure(completeLogin(cfg, pending, { code: "c" }), "state_mismatch");
  });

  it("denies an expired pending login", async () => {
    const { pending } = login();
    await failure(completeLogin(cfg, pending, { code: "c", state: pending.state }, { now: pending.createdAt + 11 * 60_000 }), "state_mismatch");
  });

  it("rejects ID tokens with wrong nonce, issuer, audience, expiry or signature", async () => {
    for (const [over, code] of [
      [{ nonce: "other" }, "nonce_mismatch"],
      [{ iss: "https://evil.invalid" }, "invalid_id_token"],
      [{ aud: "someone-else" }, "invalid_id_token"],
      [{ exp: Math.floor(Date.now() / 1000) - 60 }, "invalid_id_token"],
      [{ sub: "" }, "invalid_id_token"],
    ] as const) {
      const { pending } = login(over);
      await failure(completeLogin(cfg, pending, { code: "c", state: pending.state }), code);
    }
    const { pending } = login();
    nextClaims = claims(pending);
    const forged = { ...cfg, tokenEndpoint: cfg.tokenEndpoint }; // signature check: token signed by an unknown key
    const orig = nextClaims;
    const badSig = await sign(orig, otherKey);
    const fetchImpl = (async () => new Response(JSON.stringify({ id_token: badSig }), { status: 200 })) as typeof fetch;
    await failure(completeLogin(forged, pending, { code: "c", state: pending.state }, { fetchImpl }), "invalid_id_token");
  });

  it("surfaces token endpoint failures", async () => {
    const { pending } = login();
    tokenStatus = 400;
    try { await failure(completeLogin(cfg, pending, { code: "c", state: pending.state }), "token_exchange_failed"); }
    finally { tokenStatus = 200; }
  });
});

describe("MFA policy (provisional, pending #6 approval)", () => {
  it("requires MFA for lead, reviewer and administrator only", () => {
    expect(mfaRequiredForRoles(["researcher"])).toBe(false);
    expect(mfaRequiredForRoles(["researcher", "lead"])).toBe(true);
    expect(mfaRequiredForRoles(["administrator"])).toBe(true);
    expect(mfaRequiredForRoles([])).toBe(false);
  });
  it("only accepts real second-factor authentication methods", () => {
    expect(mfaSatisfied({ sub: "x", amr: ["pwd"] })).toBe(false);
    expect(mfaSatisfied({ sub: "x", amr: ["pwd", "otp"] })).toBe(true);
    expect(mfaSatisfied({ sub: "x", amr: [] })).toBe(false);
  });
});
