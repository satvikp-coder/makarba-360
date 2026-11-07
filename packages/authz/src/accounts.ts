import { createHash, randomBytes } from "node:crypto";
import type { Authorizer, Principal, Role } from "./policy.js";

/** Transactional database handle (pg.Client or a checked-out pool client). */
export interface Tx {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

export class AccountError extends Error {
  constructor(public readonly code: "forbidden" | "invalid" | "invitation_invalid" | "not_found", message: string) {
    super(message);
  }
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const INVITATION_TTL_MS = 7 * 24 * 3_600_000;

async function inTx<T>(db: Tx, fn: () => Promise<T>): Promise<T> {
  await db.query("BEGIN");
  try {
    const r = await fn();
    await db.query("COMMIT");
    return r;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

/**
 * Account lifecycle: invitation-only onboarding, deactivation, training records.
 * Every operation is authorised by the central Authorizer; nothing here trusts the caller.
 */
export class AccountService {
  constructor(private readonly db: Tx, private readonly authz: Authorizer, private readonly now: () => Date = () => new Date()) {}

  /** Returns the one-time token ONCE; only its hash is stored. Deliver it to the invitee out of band. */
  async invite(actor: Principal, req: { label: string; role: Role; studyAreaId: string }): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
    const d = this.authz.canAssignRole(actor, { targetUserId: "00000000-0000-0000-0000-000000000000", role: req.role, studyAreaId: req.studyAreaId });
    if (!d.allow) throw new AccountError("forbidden", "not permitted");
    if (req.role === "administrator" || req.role === "visitor") throw new AccountError("invalid", "role cannot be granted by invitation");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + INVITATION_TTL_MS);
    const r = await this.db.query(
      "INSERT INTO private.invitations (token_hash, label, role_id, study_area_id, created_by, created_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [hash(token), req.label, req.role, req.studyAreaId, actor.userId, this.now(), expiresAt],
    );
    return { invitationId: r.rows[0]!.id as string, token, expiresAt };
  }

  /**
   * Called after the invitee has authenticated with the identity provider. Single use, unexpired,
   * unrevoked; creates the user and the study-scoped grant atomically. The subject is bound to the
   * invitation, so a leaked token cannot be redeemed twice or for a different study/role.
   */
  async acceptInvitation(token: string, oidcSubject: string, displayName: string): Promise<{ userId: string }> {
    if (!oidcSubject) throw new AccountError("invalid", "subject required");
    return inTx(this.db, async () => {
      const inv = (await this.db.query(
        "SELECT id, role_id, study_area_id, created_by, expires_at, accepted_at, revoked_at FROM private.invitations WHERE token_hash = $1 FOR UPDATE",
        [hash(token)],
      )).rows[0];
      const now = this.now();
      if (!inv || inv.accepted_at || inv.revoked_at || (inv.expires_at as Date) <= now) throw new AccountError("invitation_invalid", "invitation unavailable");
      const existing = await this.db.query("SELECT id FROM private.users WHERE oidc_subject = $1", [oidcSubject]);
      if (existing.rowCount) throw new AccountError("invitation_invalid", "invitation unavailable");
      const u = await this.db.query("INSERT INTO private.users (oidc_subject, display_name) VALUES ($1,$2) RETURNING id", [oidcSubject, displayName.slice(0, 120)]);
      const userId = u.rows[0]!.id as string;
      await this.db.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,$2,$3,$4)", [userId, inv.role_id, inv.study_area_id, inv.created_by]);
      await this.db.query("UPDATE private.invitations SET accepted_at = $2, accepted_user = $3 WHERE id = $1", [inv.id, now, userId]);
      return { userId };
    });
  }

  async revokeInvitation(actor: Principal, invitationId: string): Promise<void> {
    if (!this.authz.can(actor, "user.manage").allow) throw new AccountError("forbidden", "not permitted");
    const r = await this.db.query("UPDATE private.invitations SET revoked_at = $2 WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL", [invitationId, this.now()]);
    if (!r.rowCount) throw new AccountError("not_found", "no pending invitation");
  }

  /** Deactivation takes effect at once: the account is inactive and every session is revoked in one transaction. */
  async deactivate(actor: Principal, userId: string): Promise<{ sessionsRevoked: number }> {
    if (!this.authz.can(actor, "user.manage").allow) throw new AccountError("forbidden", "not permitted");
    if (actor.userId === userId) throw new AccountError("invalid", "cannot deactivate yourself");
    return inTx(this.db, async () => {
      const u = await this.db.query("UPDATE private.users SET active = false WHERE id = $1 RETURNING id", [userId]);
      if (!u.rowCount) throw new AccountError("not_found", "unknown user");
      const s = await this.db.query("UPDATE private.sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL", [userId, this.now()]);
      return { sessionsRevoked: s.rowCount ?? 0 };
    });
  }

  /** Records a training fact. The recorder must be a user manager or a lead of the target's study; never self. */
  async recordTraining(actor: Principal, userId: string, trainingVersion: string, trainedAt: Date): Promise<void> {
    if (actor.userId === userId) throw new AccountError("invalid", "cannot record your own training");
    if (!this.authz.can(actor, "user.manage").allow) throw new AccountError("forbidden", "not permitted");
    if (trainedAt > this.now()) throw new AccountError("invalid", "training date is in the future");
    await this.db.query(
      "INSERT INTO private.researcher_profiles (user_id, training_version, trained_at, recorded_by) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET training_version = EXCLUDED.training_version, trained_at = EXCLUDED.trained_at, recorded_by = EXCLUDED.recorded_by",
      [userId, trainingVersion, trainedAt, actor.userId],
    );
  }
}
