import type { Grant, Principal, Role } from "./policy.js";

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

/** Loads a user's identity and non-revoked grants. Expiry is evaluated by the Authorizer. */
export class PgGrantStore {
  constructor(private readonly db: Queryable) {}

  async loadPrincipal(userId: string): Promise<Principal | null> {
    const u = await this.db.query("SELECT id, active FROM private.users WHERE id = $1", [userId]);
    if (!u.rows[0]) return null;
    const g = await this.db.query(
      "SELECT role_id, study_area_id, expires_at FROM private.user_roles WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    const grants: Grant[] = g.rows.map((r) => ({
      role: r.role_id as Role, studyAreaId: (r.study_area_id as string | null) ?? null, expiresAt: (r.expires_at as Date | null) ?? null,
    }));
    const trained = ((await this.db.query("SELECT 1 FROM private.researcher_profiles WHERE user_id = $1", [userId])).rowCount ?? 0) > 0;
    return { userId, active: u.rows[0].active as boolean, trained, grants };
  }

  async grant(actorId: string, userId: string, role: Role, studyAreaId: string | null, expiresAt: Date | null = null): Promise<void> {
    await this.db.query(
      "INSERT INTO private.user_roles (user_id, role_id, study_area_id, expires_at, granted_by) VALUES ($1,$2,$3,$4,$5)",
      [userId, role, studyAreaId, expiresAt, actorId],
    );
  }

  async revoke(userId: string, role: Role, studyAreaId: string | null): Promise<number> {
    const r = await this.db.query(
      "UPDATE private.user_roles SET revoked_at = now() WHERE user_id = $1 AND role_id = $2 AND study_area_id IS NOT DISTINCT FROM $3 AND revoked_at IS NULL",
      [userId, role, studyAreaId],
    );
    return r.rowCount ?? 0;
  }
}
