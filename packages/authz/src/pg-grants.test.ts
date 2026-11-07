import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { Authorizer, loadMatrix, PgGrantStore } from "./index.js";

const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const S1 = "00000000-0000-4000-8000-0000000000a1";

describe.skipIf(!url)("PgGrantStore (database)", () => {
  let c: pg.Client;
  let admin: string;
  let researcher: string;
  let store: PgGrantStore;
  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
    await migrate(c, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    const mk = async (sub: string) => (await c.query("INSERT INTO private.users (oidc_subject) VALUES ($1) RETURNING id", [sub])).rows[0].id as string;
    admin = await mk("synthetic-admin");
    researcher = await mk("synthetic-researcher");
    store = new PgGrantStore(c);
    // Bootstrap administrator through the maintenance path (superuser), granted by another user id.
    await store.grant(researcher, admin, "administrator", null);
  });

  const asRole = async (role: string, fn: () => Promise<unknown>) => {
    await c.query("BEGIN");
    try {
      await c.query(`SET LOCAL ROLE ${role}`);
      await fn();
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, code: (e as { code?: string }).code };
    } finally {
      await c.query("ROLLBACK");
    }
  };

  it("loads principals with live grants and feeds the Authorizer", async () => {
    await store.grant(admin, researcher, "researcher", S1);
    const p = await store.loadPrincipal(researcher);
    expect(p?.grants).toEqual([{ role: "researcher", studyAreaId: S1, expiresAt: null }]);
    const authz = new Authorizer(loadMatrix());
    expect(authz.can(p, "visit.start", { studyAreaId: S1, ownerId: researcher }).allow).toBe(false); // not trained yet
    await c.query("INSERT INTO private.researcher_profiles (user_id, training_version, trained_at, recorded_by) VALUES ($1,'synthetic-v1',now(),$2)", [researcher, admin]);
    const trained = (await store.loadPrincipal(researcher))!;
    expect(authz.can(trained, "visit.start", { studyAreaId: S1, ownerId: researcher }).allow).toBe(true);
    expect(authz.can(trained, "visit.start", { studyAreaId: "00000000-0000-4000-8000-0000000000a2", ownerId: researcher }).allow).toBe(false);
  });

  it("revocation removes access and a revoked grant can be re-issued", async () => {
    await store.grant(admin, researcher, "researcher", S1);
    expect(await store.revoke(researcher, "researcher", S1)).toBe(1);
    expect((await store.loadPrincipal(researcher))?.grants).toEqual([]);
    await store.grant(admin, researcher, "researcher", S1);
    expect((await store.loadPrincipal(researcher))?.grants.length).toBe(1);
  });

  it("rejects duplicate live grants, self-grants and unscoped researchers", async () => {
    await store.grant(admin, researcher, "researcher", S1);
    await expect(store.grant(admin, researcher, "researcher", S1)).rejects.toMatchObject({ code: "23505" });
    await expect(store.grant(researcher, researcher, "lead", S1)).rejects.toMatchObject({ code: "23514" });
    await expect(store.grant(admin, researcher, "lead", null)).rejects.toMatchObject({ code: "23514" });
  });

  it("a runtime role cannot create an administrator, even through SQL", async () => {
    const adminInsert = () => c.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,'administrator',NULL,$2)", [researcher, admin]);
    expect(await asRole("makarba_private_api", adminInsert)).toEqual({ ok: false, code: "42501" });
    const leadInsert = () => c.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,'lead',$2,$3)", [researcher, S1, admin]);
    expect((await asRole("makarba_private_api", leadInsert)).ok).toBe(true);
  });

  it("the public role cannot see grants", async () => {
    expect(await asRole("makarba_public_api", () => c.query("SELECT * FROM private.user_roles"))).toEqual({ ok: false, code: "42501" });
  });
});
