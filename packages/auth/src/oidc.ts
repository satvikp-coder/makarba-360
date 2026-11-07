import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export class AuthError extends Error {
  constructor(public readonly code: "state_mismatch" | "token_exchange_failed" | "invalid_id_token" | "nonce_mismatch", message: string) {
    super(message);
  }
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  scope?: string;
}

export interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

export interface IdentityClaims {
  sub: string;
  name?: string;
  amr: string[];
}

const b64url = (b: Buffer) => b.toString("base64url");

/** Starts an authorization-code + PKCE (S256) login. `pending` must be kept server-side, bound to the browser. */
export function beginLogin(cfg: OidcConfig, now = Date.now()): { url: string; pending: PendingLogin } {
  const pending: PendingLogin = {
    state: b64url(randomBytes(24)), nonce: b64url(randomBytes(24)), codeVerifier: b64url(randomBytes(48)), createdAt: now,
  };
  const u = new URL(cfg.authorizationEndpoint);
  u.search = new URLSearchParams({
    response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: cfg.scope ?? "openid profile",
    state: pending.state, nonce: pending.nonce, code_challenge: b64url(createHash("sha256").update(pending.codeVerifier).digest()),
    code_challenge_method: "S256",
  }).toString();
  return { url: u.toString(), pending };
}

export interface CompleteOptions {
  fetchImpl?: typeof fetch;
  maxPendingAgeMs?: number;
  now?: number;
}

/** Finishes login: checks state first (cross-site protection), exchanges the code, verifies the ID token. */
export async function completeLogin(
  cfg: OidcConfig, pending: PendingLogin | undefined, params: { code?: string; state?: string }, opts: CompleteOptions = {},
): Promise<IdentityClaims> {
  const now = opts.now ?? Date.now();
  if (!pending || !params.state || params.state !== pending.state || now - pending.createdAt > (opts.maxPendingAgeMs ?? 600_000)) {
    throw new AuthError("state_mismatch", "Login state missing, mismatched or expired");
  }
  if (!params.code) throw new AuthError("token_exchange_failed", "Authorization code missing");
  const doFetch = opts.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code", code: params.code, redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId, code_verifier: pending.codeVerifier,
  });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);
  const res = await doFetch(cfg.tokenEndpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new AuthError("token_exchange_failed", `Token endpoint returned ${res.status}`);
  const tok = (await res.json()) as { id_token?: string };
  if (!tok.id_token) throw new AuthError("invalid_id_token", "No id_token returned");
  let payload;
  try {
    ({ payload } = await jwtVerify(tok.id_token, createRemoteJWKSet(new URL(cfg.jwksUri)), {
      issuer: cfg.issuer, audience: cfg.clientId, algorithms: ["RS256", "ES256"],
    }));
  } catch (e) {
    throw new AuthError("invalid_id_token", `ID token rejected: ${(e as Error).message}`);
  }
  if (payload.nonce !== pending.nonce) throw new AuthError("nonce_mismatch", "ID token nonce mismatch");
  if (typeof payload.sub !== "string" || !payload.sub) throw new AuthError("invalid_id_token", "ID token has no subject");
  return { sub: payload.sub, name: typeof payload.name === "string" ? payload.name : undefined, amr: Array.isArray(payload.amr) ? payload.amr.map(String) : [] };
}

const MFA_METHODS = new Set(["mfa", "otp", "hwk", "swk", "fpt", "face", "retina", "vbm"]);
export const mfaSatisfied = (c: IdentityClaims): boolean => c.amr.some((m) => MFA_METHODS.has(m));

/**
 * PROVISIONAL MFA policy (capability matrix #6 is PROPOSED, not approved): lead, reviewer and
 * administrator require multi-factor authentication; researcher and visitor do not.
 * Revisit when #6 is approved; role assignment itself arrives with #34.
 */
export const PROVISIONAL_MFA_ROLES = ["lead", "reviewer", "administrator"] as const;
export const mfaRequiredForRoles = (roles: readonly string[]): boolean => roles.some((r) => (PROVISIONAL_MFA_ROLES as readonly string[]).includes(r));
