import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { AccountError, AccountService, Authorizer, loadMatrix, PgGrantStore, type Principal } from "./index.js";

const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";

describe.skipIf(!url)("AccountService (database)", () => {
  let c: pg.Client;
  let admin: Principal;
  let svc: AccountService;
  let grants: PgGrantStore;
  const authz = new Authorizer(loadMatrix());
  let clock = new Date();

  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
    await migrate(c, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    clock = new Date();
    grants = new PgGrantStore(c);
    svc = new AccountService(c, authz, () => clock);
    const mk = async (sub: string) => (await c.query("INSERT INTO private.users (oidc_subject) VALUES ($1) RETURNING id", [sub])).rows[0].id as string;
    const adminId = await mk("synthetic-admin");
    const seeder = await mk("synthetic-seeder");
    await grants.grant(seeder, adminId, "administrator", null); // maintenance path (superuser)
    admin = (await grants.loadPrincipal(adminId))!;
  });

  const accept = async (token: string, sub: string) => svc.acceptInvitation(token, sub, "Synthetic Person");

  it("invites, accepts once, and creates a study-scoped, untrained researcher", async () => {
    const inv = await svc.invite(admin, { label: "Synthetic researcher", role: "researcher", studyAreaId: S1 });
    expect(JSON.stringify((await c.query("SELECT * FROM private.invitations")).rows)).not.toContain(inv.token);
    const { userId } = await accept(inv.token, "synthetic-researcher");
    const p = (await grants.loadPrincipal(userId))!;
    expect(p.grants).toEqual([{ role: "researcher", studyAreaId: S1, expiresAt: null }]);
    expect(p.trained).toBe(false);
    // single use
    await expect(accept(inv.token, "another-subject")).rejects.toMatchObject({ code: "invitation_invalid" });
  });

  it("rejects expired, revoked, unknown and replayed invitations without partial state", async () => {
    const expired = await svc.invite(admin, { label: "x", role: "researcher", studyAreaId: S1 });
    clock = new Date(clock.getTime() + 8 * 24 * 3_600_000);
    await expect(accept(expired.token, "s1")).rejects.toMatchObject({ code: "invitation_invalid" });
    clock = new Date();
    const revoked = await svc.invite(admin, { label: "y", role: "researcher", studyAreaId: S1 });
    await svc.revokeInvitation(admin, revoked.invitationId);
    await expect(accept(revoked.token, "s2")).rejects.toMatchObject({ code: "invitation_invalid" });
    await expect(accept("not-a-real-token", "s3")).rejects.toMatchObject({ code: "invitation_invalid" });
    const users = await c.query("SELECT oidc_subject FROM private.users WHERE oidc_subject IN ('s1','s2','s3')");
    expect(users.rowCount).toBe(0);
  });

  it("refuses to attach an invitation to an already-registered identity", async () => {
    const inv = await svc.invite(admin, { label: "z", role: "researcher", studyAreaId: S1 });
    await expect(accept(inv.token, "synthetic-admin")).rejects.toMatchObject({ code: "invitation_invalid" });
  });

  it("only user managers can invite, and never an administrator or visitor", async () => {
    const inv = await svc.invite(admin, { label: "r", role: "researcher", studyAreaId: S1 });
    const { userId } = await accept(inv.token, "synthetic-r");
    const researcher = (await grants.loadPrincipal(userId))!;
    await expect(svc.invite(researcher, { label: "q", role: "researcher", studyAreaId: S1 })).rejects.toMatchObject({ code: "forbidden" });
    await expect(svc.invite(admin, { label: "q", role: "administrator", studyAreaId: S1 })).rejects.toBeInstanceOf(AccountError);
    await expect(svc.invite(admin, { label: "q", role: "visitor", studyAreaId: S1 })).rejects.toBeInstanceOf(AccountError);
    await expect(svc.revokeInvitation(researcher, inv.invitationId)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("collection requires invitation, training, an assigned study and an active account", async () => {
    const inv = await svc.invite(admin, { label: "r", role: "researcher", studyAreaId: S1 });
    const { userId } = await accept(inv.token, "synthetic-r");
    const own = { studyAreaId: S1, ownerId: userId };
    expect(authz.can((await grants.loadPrincipal(userId))!, "interview.create", own).allow).toBe(false); // untrained
    await svc.recordTraining(admin, userId, "synthetic-training-v1", new Date(clock.getTime() - 1000));
    const trained = (await grants.loadPrincipal(userId))!;
    expect(authz.can(trained, "interview.create", own).allow).toBe(true);
    expect(authz.can(trained, "interview.create", { studyAreaId: S2, ownerId: userId }).allow).toBe(false); // other study
    await svc.deactivate(admin, userId);
    expect(authz.can((await grants.loadPrincipal(userId))!, "interview.create", own).allow).toBe(false); // deactivated
  });

  it("training records cannot be self-issued, future-dated or issued by non-managers", async () => {
    const inv = await svc.invite(admin, { label: "r", role: "researcher", studyAreaId: S1 });
    const { userId } = await accept(inv.token, "synthetic-r");
    const researcher = (await grants.loadPrincipal(userId))!;
    await expect(svc.recordTraining(researcher, userId, "v1", new Date(0))).rejects.toMatchObject({ code: "invalid" });
    await expect(svc.recordTraining(admin, userId, "v1", new Date(clock.getTime() + 86_400_000))).rejects.toMatchObject({ code: "invalid" });
    const other = (await grants.loadPrincipal((await c.query("INSERT INTO private.users (oidc_subject) VALUES ('o') RETURNING id")).rows[0].id))!;
    await expect(svc.recordTraining(other, userId, "v1", new Date(0))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("deactivation revokes every live session at once and cannot target yourself", async () => {
    const inv = await svc.invite(admin, { label: "r", role: "researcher", studyAreaId: S1 });
    const { userId } = await accept(inv.token, "synthetic-r");
    for (const n of ["a", "b"]) {
      await c.query("INSERT INTO private.sessions (token_hash, csrf_hash, user_id, absolute_expires_at) VALUES ($1,$1,$2, now() + interval '1 hour')", [n.repeat(64), userId]);
    }
    expect(await svc.deactivate(admin, userId)).toEqual({ sessionsRevoked: 2 });
    expect((await c.query("SELECT active FROM private.users WHERE id = $1", [userId])).rows[0].active).toBe(false);
    expect((await c.query("SELECT count(*)::int AS n FROM private.sessions WHERE user_id = $1 AND revoked_at IS NULL", [userId])).rows[0].n).toBe(0);
    await expect(svc.deactivate(admin, admin.userId)).rejects.toMatchObject({ code: "invalid" });
    await expect(svc.deactivate(admin, "00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({ code: "not_found" });
  });
});
