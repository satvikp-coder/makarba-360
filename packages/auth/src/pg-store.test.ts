import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { PgSessionStore, SessionService, sha256 } from "./index.js";

const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");

describe.skipIf(!url)("PgSessionStore (database)", () => {
  let c: pg.Client;
  let userId: string;
  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
    await migrate(c, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    userId = (await c.query("INSERT INTO private.users (oidc_subject, display_name) VALUES ('synthetic-sub','Synthetic') RETURNING id")).rows[0].id;
  });

  const make = (now = () => new Date()) => new SessionService({ store: new PgSessionStore(c), now, idleMs: 1000, absoluteMs: 5000 });

  it("persists only hashes and validates a live session", async () => {
    const svc = make();
    const { token, csrfToken } = await svc.create(userId, true);
    const raw = JSON.stringify((await c.query("SELECT * FROM private.sessions")).rows);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(csrfToken);
    expect((await c.query("SELECT 1 FROM private.sessions WHERE token_hash = $1", [sha256(token)])).rowCount).toBe(1);
    expect(await svc.validate(token)).toMatchObject({ ok: true, session: { userId, mfa: true } });
  });

  it("expires, revokes and rejects deactivated users", async () => {
    let t = Date.now();
    const svc = make(() => new Date(t));
    const a = await svc.create(userId, false);
    t += 1500;
    expect(await svc.validate(a.token)).toEqual({ ok: false, reason: "idle_expired" });
    t = Date.now();
    const b = await make().create(userId, false);
    expect(await make().revokeUser(userId)).toBeGreaterThanOrEqual(1);
    expect(await make().validate(b.token)).toEqual({ ok: false, reason: "revoked" });
    const d = await make().create(userId, false);
    await c.query("UPDATE private.users SET active = false WHERE id = $1", [userId]);
    expect(await make().validate(d.token)).toEqual({ ok: false, reason: "user_inactive" });
  });

  it("is invisible to the public role", async () => {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE makarba_public_api");
    await expect(c.query("SELECT * FROM private.sessions")).rejects.toMatchObject({ code: "42501" });
    await c.query("ROLLBACK");
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE makarba_private_api");
    await expect(c.query("SELECT count(*) FROM private.sessions")).resolves.toBeTruthy();
    await expect(c.query("DELETE FROM private.sessions")).rejects.toMatchObject({ code: "42501" });
    await c.query("ROLLBACK");
  });
});
