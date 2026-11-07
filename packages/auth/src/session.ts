import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
export const newToken = (): string => randomBytes(32).toString("base64url");

export interface SessionRecord {
  tokenHash: string;
  csrfHash: string;
  userId: string;
  mfa: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionStore {
  create(rec: SessionRecord): Promise<void>;
  find(tokenHash: string): Promise<(SessionRecord & { userActive: boolean }) | null>;
  touch(tokenHash: string, at: Date): Promise<void>;
  revoke(tokenHash: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<number>;
}

export interface Session {
  userId: string;
  mfa: boolean;
  csrfHash: string;
}

export type SessionDenial = "unknown" | "revoked" | "idle_expired" | "absolute_expired" | "user_inactive";

export interface SessionOptions {
  store: SessionStore;
  idleMs?: number; // default 30 minutes
  absoluteMs?: number; // default 12 hours
  now?: () => Date;
}

/** Opaque server-side sessions. Raw tokens exist only in the cookie/response, never in storage. */
export class SessionService {
  private readonly idleMs: number;
  private readonly absoluteMs: number;
  private readonly now: () => Date;
  constructor(private readonly o: SessionOptions) {
    this.idleMs = o.idleMs ?? 30 * 60_000;
    this.absoluteMs = o.absoluteMs ?? 12 * 3_600_000;
    this.now = o.now ?? (() => new Date());
  }

  async create(userId: string, mfa: boolean): Promise<{ token: string; csrfToken: string }> {
    const token = newToken();
    const csrfToken = newToken();
    const now = this.now();
    await this.o.store.create({
      tokenHash: sha256(token), csrfHash: sha256(csrfToken), userId, mfa,
      createdAt: now, lastSeenAt: now, absoluteExpiresAt: new Date(now.getTime() + this.absoluteMs), revokedAt: null,
    });
    return { token, csrfToken };
  }

  async validate(token: string | undefined): Promise<{ ok: true; session: Session } | { ok: false; reason: SessionDenial }> {
    if (!token) return { ok: false, reason: "unknown" };
    const rec = await this.o.store.find(sha256(token));
    if (!rec) return { ok: false, reason: "unknown" };
    const now = this.now();
    if (rec.revokedAt) return { ok: false, reason: "revoked" };
    if (!rec.userActive) return { ok: false, reason: "user_inactive" };
    if (now >= rec.absoluteExpiresAt) return { ok: false, reason: "absolute_expired" };
    if (now.getTime() - rec.lastSeenAt.getTime() >= this.idleMs) return { ok: false, reason: "idle_expired" };
    await this.o.store.touch(rec.tokenHash, now);
    return { ok: true, session: { userId: rec.userId, mfa: rec.mfa, csrfHash: rec.csrfHash } };
  }

  /** Constant-time check of a presented CSRF token against the session's stored hash. */
  csrfValid(session: Session, presented: string | undefined): boolean {
    if (!presented) return false;
    const a = Buffer.from(sha256(presented), "hex");
    const b = Buffer.from(session.csrfHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.o.store.revoke(sha256(token), this.now());
  }

  /** Immediate revocation of every session of a user (deactivation, suspected theft). */
  revokeUser(userId: string): Promise<number> {
    return this.o.store.revokeAllForUser(userId, this.now());
  }
}

export class MemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, SessionRecord>();
  readonly inactiveUsers = new Set<string>();
  async create(rec: SessionRecord) { this.sessions.set(rec.tokenHash, { ...rec }); }
  async find(h: string) {
    const r = this.sessions.get(h);
    return r ? { ...r, userActive: !this.inactiveUsers.has(r.userId) } : null;
  }
  async touch(h: string, at: Date) { const r = this.sessions.get(h); if (r) r.lastSeenAt = at; }
  async revoke(h: string, at: Date) { const r = this.sessions.get(h); if (r && !r.revokedAt) r.revokedAt = at; }
  async revokeAllForUser(userId: string, at: Date) {
    let n = 0;
    for (const r of this.sessions.values()) if (r.userId === userId && !r.revokedAt) { r.revokedAt = at; n++; }
    return n;
  }
}
