import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { AuditError, failSafe, MemoryAuditSink, PgAuditSink, validateEvent, type SecurityEvent } from "./index.js";

const U = "00000000-0000-4000-8000-0000000000c1";
const good: SecurityEvent = { actorId: U, action: "interview.view_private", outcome: "deny", reasonCode: "forbidden", studyAreaId: U, resourceType: "interview", resourceId: U, revision: 2, requestId: "req-12345678" };

describe("event validation (no payload leaks)", () => {
  it("accepts a clean event", () => {
    expect(validateEvent(good)).toBe(good);
  });
  it("rejects any extra field that could carry content", () => {
    for (const k of ["payload", "answers", "latitude", "longitude", "token", "sessionToken", "note", "ip"]) {
      expect(() => validateEvent({ ...good, [k]: "x" } as SecurityEvent), k).toThrow(AuditError);
    }
  });
  it("rejects values that are not identifiers or codes", () => {
    expect(() => validateEvent({ ...good, resourceId: "10.5,10.5" })).toThrow(/UUID/);
    expect(() => validateEvent({ ...good, action: "free text with spaces and an answer" })).toThrow(/invalid action/);
    expect(() => validateEvent({ ...good, reasonCode: "because the participant said x" as never })).toThrow(/reason/);
    expect(() => validateEvent({ ...good, requestId: "a cookie=abc" })).toThrow(/request id/);
    expect(() => validateEvent({ ...good, revision: -1 })).toThrow(/revision/);
  });
  it("memory sink stores only validated events and failSafe reports errors", async () => {
    const m = new MemoryAuditSink();
    await m.record(good);
    expect(m.events).toHaveLength(1);
    await expect(m.record({ ...good, action: "BAD" })).rejects.toThrow();
    const errors: unknown[] = [];
    await failSafe(m, (e) => errors.push(e)).record({ ...good, action: "BAD" });
    expect(errors).toHaveLength(1);
  });
});

const url = process.env.TEST_DATABASE_URL;
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");

describe.skipIf(!url)("PgAuditSink (database)", () => {
  let c: pg.Client;
  beforeAll(async () => { c = new pg.Client({ connectionString: url }); await c.connect(); });
  afterAll(async () => { await c.end(); });
  beforeEach(async () => {
    await c.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await c.query(bootstrap);
    await migrate(c, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
  });
  const asRole = async (role: string, sql: string) => {
    await c.query("BEGIN");
    try { await c.query(`SET LOCAL ROLE ${role}`); await c.query(sql); return { ok: true as const }; }
    catch (e) { return { ok: false as const, code: (e as { code?: string }).code }; }
    finally { await c.query("ROLLBACK"); }
  };

  it("records events with no content columns", async () => {
    await new PgAuditSink(c).record(good);
    const r = await c.query("SELECT * FROM audit.security_events");
    expect(r.rowCount).toBe(1);
    expect(Object.keys(r.rows[0]).sort()).toEqual(["action", "actor_id", "at", "id", "outcome", "reason_code", "request_id", "resource_id", "resource_type", "revision", "study_area_id"]);
  });
  it("the database rejects free-text reason codes and malformed values", async () => {
    await expect(c.query("INSERT INTO audit.security_events (action, outcome, reason_code) VALUES ('a.b','deny','the answer was 12')")).rejects.toMatchObject({ code: "23514" });
    await expect(c.query("INSERT INTO audit.security_events (action, outcome, reason_code, request_id) VALUES ('a.b','deny','forbidden','cookie=abc;x')")).rejects.toMatchObject({ code: "23514" });
  });
  it("is append-only for runtime roles and even for the owner and superuser", async () => {
    await new PgAuditSink(c).record(good);
    for (const role of ["makarba_private_api", "makarba_worker"]) {
      expect((await asRole(role, "UPDATE audit.security_events SET outcome = 'allow'")).code, role).toBe("42501");
      expect((await asRole(role, "DELETE FROM audit.security_events")).code, role).toBe("42501");
      expect((await asRole(role, "TRUNCATE audit.security_events")).code, role).toBe("42501");
      expect((await asRole(role, "SELECT * FROM audit.security_events")).code, role).toBe("42501");
    }
    expect((await asRole("makarba_private_api", "INSERT INTO audit.security_events (action, outcome, reason_code) VALUES ('a.b','deny','forbidden')")).ok).toBe(true);
    expect((await asRole("makarba_migrator", "UPDATE audit.security_events SET outcome = 'allow'")).code).toBe("42501");
    await expect(c.query("DELETE FROM audit.security_events")).rejects.toMatchObject({ code: "42501" });
    expect((await asRole("makarba_public_api", "SELECT * FROM audit.security_events")).code).toBe("42501");
  });
});
