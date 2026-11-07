import { Router, type Request, type RequestHandler, type Response } from "express";
import {
  AuthError, beginLogin, completeLogin, mfaRequiredForRoles, mfaSatisfied, type OidcConfig, type PendingLogin, type Session, type SessionService,
} from "@makarba/auth";

export interface UserDirectory {
  /** Only provisioned, active users may sign in (invitations are issue #33); unknown subjects are denied. */
  findActiveBySubject(sub: string): Promise<{ id: string; roles: string[] } | null>;
}

export interface InvitationRedeemer {
  /** Redeems a one-time invitation for an authenticated identity. Throws if invalid. */
  accept(token: string, oidcSubject: string, displayName: string): Promise<void>;
}

export interface AuthDeps {
  oidc: OidcConfig;
  sessions: SessionService;
  users: UserDirectory;
  /** Optional: enables invitation-only onboarding (issue #33). */
  invitations?: InvitationRedeemer;
  secureCookies: boolean;
  fetchImpl?: typeof fetch;
}

const SESSION_COOKIE = "mk_session";
const LOGIN_COOKIE = "mk_login";

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res: Response, name: string, value: string, secure: boolean, maxAgeSec: number, path = "/") {
  const attrs = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Middleware: attach req.session or answer 401. Private routes must use this (deny by default). */
export function requireSession(sessions: SessionService): RequestHandler {
  return async (req, res, next) => {
    const v = await sessions.validate(cookies(req)[SESSION_COOKIE]);
    if (!v.ok) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: "Sign in required", fieldErrors: {}, requestId: "n/a", retryable: false });
      return;
    }
    req.session = v.session;
    next();
  };
}

/** CSRF protection for cookie-authenticated writes: X-CSRF-Token must match the session's token. */
export function requireCsrf(sessions: SessionService): RequestHandler {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const header = req.headers["x-csrf-token"];
    if (!req.session || !sessions.csrfValid(req.session, typeof header === "string" ? header : undefined)) {
      res.status(403).json({ code: "CSRF", message: "Missing or invalid CSRF token", fieldErrors: {}, requestId: "n/a", retryable: false });
      return;
    }
    next();
  };
}

export function authRouter(deps: AuthDeps): Router {
  const r = Router();
  // Pending logins live server-side, keyed by an unguessable cookie value (single instance; see docs for limits).
  const pending = new Map<string, { login: PendingLogin; invite?: string }>();
  const deny = (res: Response, status: number, code: string, message: string) =>
    res.status(status).json({ code, message, fieldErrors: {}, requestId: "n/a", retryable: false });

  r.get("/login", (req, res) => {
    const { url, pending: p } = beginLogin(deps.oidc);
    // The invitation token stays server-side; it is never put in the redirect URL or a cookie.
    pending.set(p.state, { login: p, invite: typeof req.query.invite === "string" && req.query.invite.length <= 200 ? req.query.invite : undefined });
    setCookie(res, LOGIN_COOKIE, p.state, deps.secureCookies, 600, "/auth");
    res.redirect(302, url);
  });

  r.get("/callback", async (req, res) => {
    const state = cookies(req)[LOGIN_COOKIE];
    const entry = state ? pending.get(state) : undefined;
    const p = entry?.login;
    if (state) pending.delete(state); // single use
    try {
      const id = await completeLogin(deps.oidc, p, { code: String(req.query.code ?? ""), state: String(req.query.state ?? "") }, { fetchImpl: deps.fetchImpl });
      let user = await deps.users.findActiveBySubject(id.sub);
      if (!user && entry?.invite && deps.invitations) {
        try {
          await deps.invitations.accept(entry.invite, id.sub, id.name ?? "");
          user = await deps.users.findActiveBySubject(id.sub);
        } catch {
          return void deny(res, 403, "NOT_PROVISIONED", "This account is not authorised for the research application");
        }
      }
      if (!user) return void deny(res, 403, "NOT_PROVISIONED", "This account is not authorised for the research application");
      if (mfaRequiredForRoles(user.roles) && !mfaSatisfied(id)) return void deny(res, 403, "MFA_REQUIRED", "Multi-factor authentication is required for this role");
      const { token, csrfToken } = await deps.sessions.create(user.id, mfaSatisfied(id));
      setCookie(res, SESSION_COOKIE, token, deps.secureCookies, 12 * 3600);
      setCookie(res, LOGIN_COOKIE, "", deps.secureCookies, 0, "/auth");
      res.json({ ok: true, csrfToken });
    } catch (e) {
      if (e instanceof AuthError) return void deny(res, e.code === "state_mismatch" ? 400 : 401, "LOGIN_FAILED", "Sign-in could not be completed");
      throw e;
    }
  });

  r.post("/logout", requireSession(deps.sessions), requireCsrf(deps.sessions), async (req, res) => {
    await deps.sessions.logout(cookies(req)[SESSION_COOKIE]);
    setCookie(res, SESSION_COOKIE, "", deps.secureCookies, 0);
    res.json({ ok: true });
  });

  r.get("/me", requireSession(deps.sessions), (req, res) => res.json({ userId: req.session!.userId, mfa: req.session!.mfa }));
  return r;
}
