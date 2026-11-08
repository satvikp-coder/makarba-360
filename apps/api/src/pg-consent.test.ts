import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { applyConsent, consentFlags, type ConsentEvent } from "./consent.js";
import { CONSENT_CASES } from "./consent-cases.js";
import { ConsentRepoError, PgConsentRepository } from "./consent-repository.js";

// CI `database` job on real PostGIS (skipped locally without TEST_DATABASE_URL). Synthetic people and scripts only.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";

describe.skipIf(!url)("consent in PostGIS (issue #37) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, repo: PgConsentRepository, user: string, approved: string, draft: string;
  beforeAll(async () => { admin = new pg.Client({ connectionString: url }); await admin.connect(); app = new pg.Client({ connectionString: url }); await app.connect(); });
  afterAll(async () => { await admin.end(); await app.end(); });
  beforeEach(async () => {
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    user = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-r') RETURNING id")).rows[0].id;
    const sha = "a".repeat(64);
    approved = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256, status, approved_by, approved_at) VALUES ('v1','en',$1,'approved','SYNTHETIC TEST AUTHORITY', now()) RETURNING id", [sha])).rows[0].id;
    draft = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256) VALUES ('v2-draft','en',$1) RETURNING id", [sha])).rows[0].id;
    await app.query("RESET ROLE"); await app.query("SET ROLE makarba_private_api");
    repo = new PgConsentRepository(app);
  });
  const rec = (interviewId: string, scope: ConsentEvent["scope"], decision: ConsentEvent["decision"], over: { script?: string; studyAreaId?: string; language?: string } = {}) =>
    repo.record({ interviewId, studyAreaId: over.studyAreaId ?? AREA, scope, decision, scriptVersionId: over.script ?? approved, language: over.language ?? "en", actorId: user });
  const outcome = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof ConsentRepoError ? e.code : (e as { code?: string }).code ?? "error"));

  it("the database gives the same answer as the pure rules for every case in the shared table", async () => {
    for (const c of CONSENT_CASES) {
      const iv = randomUUID();
      let history: ConsentEvent[] = [];
      for (const [i, s] of c.steps.entries()) {
        const script = (s.script ?? "approved") === "approved" ? approved : draft;
        const pure = applyConsent(history, { scope: s.scope, decision: s.decision }, script === approved);
        const db = await outcome(rec(iv, s.scope, s.decision, { script }));
        expect(db, `${c.name} step ${i + 1}`).toBe(s.expect);
        expect(pure.ok ? "ok" : pure.reason).toBe(s.expect);
        if (pure.ok) history = pure.history;
      }
      const flags = (await admin.query("SELECT * FROM private.interview_consent_flags WHERE interview_id = $1", [iv])).rows[0];
      const f = consentFlags(history);
      expect({ research: flags.consent_research, aggregate: flags.consent_aggregate, rec: flags.consent_recording, media: flags.consent_identifiable_media, story: flags.consent_identifiable_story, withdrawn: flags.withdrawn })
        .toEqual({ research: f.consentResearch, aggregate: f.consentAggregate, rec: f.consentRecording, media: f.consentIdentifiableMedia, story: f.consentIdentifiableStory, withdrawn: f.withdrawn });
    }
  });

  it("withdrawing participation records a withdrawal for each granted scope in the same transaction", async () => {
    const iv = randomUUID();
    await rec(iv, "participation", "granted"); await rec(iv, "recording", "granted"); await rec(iv, "aggregate_use", "granted"); await rec(iv, "identifiable_media", "refused");
    const view = await rec(iv, "participation", "withdrawn");
    expect(view.state).toMatchObject({ participation: "withdrawn", recording: "withdrawn", aggregate_use: "withdrawn", identifiable_media: "refused" });
    expect(view.flags).toMatchObject({ consentResearch: false, consentAggregate: false, withdrawn: true });
  });

  it("history is append-only: even the table owner cannot update, delete or truncate", async () => {
    const iv = randomUUID();
    await rec(iv, "participation", "granted");
    await expect(admin.query("UPDATE private.consent_events SET decision = 'refused'")).rejects.toMatchObject({ code: "23001" });
    await expect(admin.query("DELETE FROM private.consent_events")).rejects.toMatchObject({ code: "23001" });
    await expect(admin.query("TRUNCATE private.consent_events")).rejects.toMatchObject({ code: "23001" });
    await expect(app.query("UPDATE private.consent_events SET decision = 'refused'")).rejects.toMatchObject({ code: "42501" });
    await expect(app.query("DELETE FROM private.consent_events")).rejects.toMatchObject({ code: "42501" });
  });

  it("scripts: the private API cannot create, approve or edit script versions; an approved one needs a named authority", async () => {
    await expect(app.query("UPDATE private.consent_script_versions SET status = 'approved' WHERE id = $1", [draft])).rejects.toMatchObject({ code: "42501" });
    await expect(app.query("INSERT INTO private.consent_script_versions (version, language, content_sha256) VALUES ('x','en',$1)", ["b".repeat(64)])).rejects.toMatchObject({ code: "42501" });
    await expect(admin.query("UPDATE private.consent_script_versions SET status = 'approved' WHERE id = $1", [draft])).rejects.toMatchObject({ code: "23514" });
  });

  it("language must match the script version, an unknown script is rejected, and an interview cannot move to another study", async () => {
    const iv = randomUUID();
    expect(await outcome(rec(iv, "participation", "granted", { language: "gu" }))).toBe("rejected_value");
    expect(await outcome(rec(iv, "participation", "granted", { script: randomUUID() }))).toBe("rejected_value");
    expect(await outcome(rec(iv, "participation", "granted"))).toBe("ok");
    expect(await outcome(rec(iv, "recording", "granted", { studyAreaId: OTHER }))).toBe("rejected_value");
  });

  it("two simultaneous decisions for one scope: exactly one wins", async () => {
    const iv = randomUUID();
    await rec(iv, "participation", "granted");
    const other = new pg.Client({ connectionString: url }); await other.connect(); await other.query("SET ROLE makarba_private_api");
    const repo2 = new PgConsentRepository(other);
    const results = await Promise.all([outcome(rec(iv, "recording", "granted")), outcome(repo2.record({ interviewId: iv, studyAreaId: AREA, scope: "recording", decision: "refused", scriptVersionId: approved, language: "en", actorId: user }))]);
    await other.end();
    expect(results.filter((x) => x === "ok")).toHaveLength(1);
    expect(results.filter((x) => x === "overwrite_blocked" || x === "already_granted")).toHaveLength(1);
  });

  it("the public API role can read none of it", async () => {
    const pub = new pg.Client({ connectionString: url }); await pub.connect(); await pub.query("SET ROLE makarba_public_api");
    for (const t of ["consent_events", "consent_script_versions", "current_consent", "interview_consent_flags"]) await expect(pub.query(`SELECT * FROM private.${t}`)).rejects.toMatchObject({ code: "42501" });
    await pub.end();
  });
});
