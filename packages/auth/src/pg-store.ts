import type { SessionRecord, SessionStore } from "./session.js";

/** Minimal surface shared by pg.Pool and pg.Client. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

export class PgSessionStore implements SessionStore {
  constructor(private readonly db: Queryable) {}

  async create(r: SessionRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO private.sessions (token_hash, csrf_hash, user_id, mfa, created_at, last_seen_at, absolute_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.tokenHash, r.csrfHash, r.userId, r.mfa, r.createdAt, r.lastSeenAt, r.absoluteExpiresAt],
    );
  }

  async find(tokenHash: string) {
    const { rows } = await this.db.query(
      `SELECT s.token_hash, s.csrf_hash, s.user_id, s.mfa, s.created_at, s.last_seen_at, s.absolute_expires_at, s.revoked_at, u.active
         FROM private.sessions s JOIN private.users u ON u.id = s.user_id WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      tokenHash: r.token_hash as string, csrfHash: r.csrf_hash as string, userId: r.user_id as string, mfa: r.mfa as boolean,
      createdAt: r.created_at as Date, lastSeenAt: r.last_seen_at as Date, absoluteExpiresAt: r.absolute_expires_at as Date,
      revokedAt: (r.revoked_at as Date | null) ?? null, userActive: r.active as boolean,
    };
  }

  async touch(tokenHash: string, at: Date): Promise<void> {
    await this.db.query("UPDATE private.sessions SET last_seen_at = $2 WHERE token_hash = $1", [tokenHash, at]);
  }

  async revoke(tokenHash: string, at: Date): Promise<void> {
    await this.db.query("UPDATE private.sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash, at]);
  }

  async revokeAllForUser(userId: string, at: Date): Promise<number> {
    const r = await this.db.query("UPDATE private.sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL", [userId, at]);
    return r.rowCount ?? 0;
  }
}
