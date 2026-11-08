import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { SYNTHETIC_INSTRUMENT } from "@makarba/survey";
import { PgConsentRepository } from "./consent-repository.js";
import { FieldRepoError, PgFieldRepository } from "./field-repository.js";
import { SurveyPublisher } from "./survey-repository.js";

// CI `database` job on real PostGIS (skipped locally without TEST_DATABASE_URL). Synthetic people and the SYNTHETIC instrument only.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";

describe.skipIf(!url)("visits, interviews and draft answers in PostGIS (issues #44, #45) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, field: PgFieldRepository, consent: PgConsentRepository;
  let ann: string, bob: string, survey: string, draftSurvey: string, script: string;
  beforeAll(async () => { admin = new pg.Client({ connectionString: url }); await admin.connect(); app = new pg.Client({ connectionString: url }); await app.connect(); });
  afterAll(async () => { await admin.end(); await app.end(); });
  beforeEach(async () => {
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    ann = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-ann') RETURNING id")).rows[0].id;
    bob = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-bob') RETURNING id")).rows[0].id;
    const pub = new SurveyPublisher(admin);
    const d = await pub.createDraft(SYNTHETIC_INSTRUMENT, null);
    survey = (await pub.publish(d.id, "SYNTHETIC TEST AUTHORITY", null)).id;
    draftSurvey = (await pub.createDraft({ ...SYNTHETIC_INSTRUMENT, code: "synthetic-draft" }, null)).id;
    script = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256, status, approved_by, approved_at) VALUES ('v1','en',$1,'approved','SYNTHETIC TEST AUTHORITY', now()) RETURNING id", ["a".repeat(64)])).rows[0].id;
    await app.query("RESET ROLE"); await app.query("SET ROLE makarba_private_api");
    field = new PgFieldRepository(app); consent = new PgConsentRepository(app);
  });
  const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof FieldRepoError ? e.code : (e as { code?: string }).code ?? "error"));
  const grant = (interviewId: string, who = ann) => consent.record({ interviewId, studyAreaId: AREA, scope: "participation", decision: "granted", scriptVersionId: script, language: "en", actorId: who });
  const start = (visitId: string, id: string, over: Partial<{ collectorId: string; surveyVersionId: string; studyAreaId: string }> = {}) =>
    field.startInterview({ id, visitId, collectorId: over.collectorId ?? ann, studyAreaId: over.studyAreaId ?? AREA, surveyVersionId: over.surveyVersionId ?? survey, startedAt: "2026-01-01T10:00:00.000Z", startedOffsetMinutes: 330 });

  it("a visit starts active, records its status history, and cannot be deleted or reopened", async () => {
    const v = await field.startVisit(ann, AREA);
    expect(v.status).toBe("active");
    await field.endVisit(v.id, {});
    const got = (await field.getVisit(v.id))!;
    expect(got.status).toBe("ended");
    expect(got.history.map((h) => h.status)).toEqual(["active", "ended"]);
    expect(await code(app.query("UPDATE private.field_visits SET status = 'active', ended_at = NULL WHERE id = $1", [v.id]))).toBe("23001");
    expect(await code(app.query("DELETE FROM private.field_visits WHERE id = $1", [v.id]))).toBe("42501");
    expect(await code(field.endVisit(v.id, {}))).toBe("not_active");
  });

  it("an interview needs an active visit of the same researcher and study, a published questionnaire and a granted participation consent", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID();
    expect(await code(start(v.id, iv))).toBe("consent_required");                            // no consent yet
    await grant(iv);
    expect(await code(start(v.id, iv, { collectorId: bob }))).toBe("rejected_value");        // the visit and the consent belong to ann, not bob
    expect(await code(start(v.id, iv, { surveyVersionId: draftSurvey }))).toBe("rejected_value");   // a draft questionnaire cannot be used
    expect(await code(start(v.id, iv, { studyAreaId: "00000000-0000-4000-8000-0000000000a2" }))).toBe("rejected_value");
    const ok = await start(v.id, iv);
    expect(ok).toMatchObject({ created: true, interview: { status: "draft", surveyVersionId: survey } });
  });

  it("a repeated tap or retry returns the same interview; the same id with different details is a conflict", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID(); await grant(iv);
    const first = await start(v.id, iv);
    const second = await start(v.id, iv);
    expect([first.created, second.created, second.interview.id]).toEqual([true, false, iv]);
    const racing = await Promise.all([start(v.id, iv), start(v.id, iv)]);
    expect(racing.every((r) => !r.created)).toBe(true);
    await expect(field.startInterview({ id: iv, visitId: v.id, collectorId: ann, studyAreaId: AREA, surveyVersionId: survey, startedAt: "2026-02-02T10:00:00.000Z", startedOffsetMinutes: 330 })).rejects.toMatchObject({ code: "conflict" });
    expect((await admin.query("SELECT count(*)::int AS n FROM private.interviews")).rows[0].n).toBe(1);
  });

  it("a retry after the visit has ended still returns the existing interview, but no new interview can start on an ended visit", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID(); await grant(iv); await start(v.id, iv);
    await field.endVisit(v.id, { [iv]: "keep" });
    expect((await start(v.id, iv)).created).toBe(false);
    const iv2 = randomUUID(); await grant(iv2);
    expect(await code(start(v.id, iv2))).toBe("not_active");
  });

  it("ending a visit with open drafts needs a decision for each: keep for sync or abandon (never deleted)", async () => {
    const v = await field.startVisit(ann, AREA);
    const a = randomUUID(), b = randomUUID();
    await grant(a); await grant(b); await start(v.id, a); await start(v.id, b);
    await expect(field.endVisit(v.id, {})).rejects.toMatchObject({ code: "pending_drafts", ids: expect.arrayContaining([a, b]) });
    await expect(field.endVisit(v.id, { [a]: "keep" })).rejects.toMatchObject({ code: "pending_drafts", ids: [b] });
    expect((await field.getVisit(v.id))!.status).toBe("active");
    await field.endVisit(v.id, { [a]: "keep", [b]: "abandon" });
    expect((await field.getInterview(a))!.status).toBe("draft");
    expect((await field.getInterview(b))!.status).toBe("abandoned");
    expect(await code(app.query("DELETE FROM private.interviews WHERE id = $1", [b]))).toBe("42501");
    expect(await code(admin.query("DELETE FROM private.interviews WHERE id = $1", [b]))).toBe("23001");
  });

  it("answers: only for questions of the pinned version, only while a draft, value xor missing", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID(); await grant(iv); await start(v.id, iv);
    await field.saveAnswers(iv, { C01: { value: true }, Q02: { value: 4 } });
    await field.saveAnswers(iv, { Q02: { missing: "unsure" } });                              // an update replaces, never duplicates
    expect((await field.getInterview(iv))!.answers).toEqual({ C01: { value: true }, Q02: { missing: "unsure" } });
    expect(await code(field.saveAnswers(iv, { Q99: { value: 1 } }))).toBe("rejected_value");
    expect(await code(app.query("INSERT INTO private.interview_answers (interview_id, question_code, value, missing_reason) VALUES ($1,'Q01','[\"heritage\"]','unsure')", [iv]))).toBe("23514");
    await app.query("UPDATE private.interviews SET status = 'abandoned' WHERE id = $1", [iv]);
    expect(await code(field.saveAnswers(iv, { Q02: { value: 1 } }))).toBe("not_draft");
    expect(await code(app.query("UPDATE private.interviews SET survey_version_id = $2 WHERE id = $1", [iv, draftSurvey]))).toBe("23001");
    expect(await code(app.query("UPDATE private.interviews SET status = 'draft' WHERE id = $1", [iv]))).toBe("23001");
  });

  it("withdrawing participation discards every answer, marks the interview withdrawn, and cannot be undone", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID(); await grant(iv); await start(v.id, iv);
    await field.saveAnswers(iv, { C01: { value: true }, Q02: { value: 2 }, Q05: { value: "synthetic words" } });
    await consent.record({ interviewId: iv, studyAreaId: AREA, scope: "participation", decision: "withdrawn", scriptVersionId: script, language: "en", actorId: ann });
    const after = (await field.getInterview(iv))!;
    expect(after.status).toBe("withdrawn");
    expect(after.answers).toEqual({});
    expect((await admin.query("SELECT count(*)::int AS n FROM private.interview_answers WHERE interview_id = $1", [iv])).rows[0].n).toBe(0);
    expect(await code(field.saveAnswers(iv, { Q02: { value: 3 } }))).toBe("not_draft");
    expect(await code(app.query("UPDATE private.interviews SET status = 'draft' WHERE id = $1", [iv]))).toBe("23001");
    expect(await code(grant(iv))).toBe("overwrite_blocked");
  });

  it("the discard flag cannot be used by the API role to delete answers, and the public role sees nothing", async () => {
    const v = await field.startVisit(ann, AREA);
    const iv = randomUUID(); await grant(iv); await start(v.id, iv);
    await field.saveAnswers(iv, { Q02: { value: 2 } });
    await app.query("SELECT set_config('makarba.discarding', 'on', false)");
    expect(await code(app.query("DELETE FROM private.interview_answers WHERE interview_id = $1", [iv]))).toBe("42501");
    await app.query("SELECT set_config('makarba.discarding', 'off', false)");
    const pubc = new pg.Client({ connectionString: url }); await pubc.connect(); await pubc.query("SET ROLE makarba_public_api");
    for (const t of ["field_visits", "interviews", "interview_answers"]) expect(await code(pubc.query(`SELECT * FROM private.${t}`))).toBe("42501");
    await pubc.end();
  });
});
