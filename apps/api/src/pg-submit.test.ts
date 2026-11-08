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

describe.skipIf(!url)("submit and independent review in PostGIS (issue #52 server side) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, field: PgFieldRepository, consent: PgConsentRepository;
  let ann: string, bob: string, cat: string, survey: string, script: string, visitId: string;
  beforeAll(async () => { admin = new pg.Client({ connectionString: url }); await admin.connect(); app = new pg.Client({ connectionString: url }); await app.connect(); });
  afterAll(async () => { await admin.end(); await app.end(); });
  beforeEach(async () => {
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    ann = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-ann') RETURNING id")).rows[0].id;
    bob = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-bob') RETURNING id")).rows[0].id;
    cat = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-cat') RETURNING id")).rows[0].id;
    const pub = new SurveyPublisher(admin);
    survey = (await pub.publish((await pub.createDraft(SYNTHETIC_INSTRUMENT, null)).id, "SYNTHETIC TEST AUTHORITY", null)).id;
    script = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256, status, approved_by, approved_at) VALUES ('v1','en',$1,'approved','SYNTHETIC TEST AUTHORITY', now()) RETURNING id", ["a".repeat(64)])).rows[0].id;
    await app.query("RESET ROLE"); await app.query("SET ROLE makarba_private_api");
    field = new PgFieldRepository(app); consent = new PgConsentRepository(app);
    visitId = (await field.startVisit(ann, AREA)).id;
  });
  const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof FieldRepoError ? e.code : (e as { code?: string }).code ?? "error"));
  async function draft(withPosition = true) {
    const iv = randomUUID();
    await consent.record({ interviewId: iv, studyAreaId: AREA, scope: "participation", decision: "granted", scriptVersionId: script, language: "en", actorId: ann });
    await field.startInterview({ id: iv, visitId, collectorId: ann, studyAreaId: AREA, surveyVersionId: survey, startedAt: "2026-01-01T10:00:00.000Z", startedOffsetMinutes: 330 });
    if (withPosition) await field.recordPosition(iv, ann, { state: "denied", permissionState: "denied", reason: "participant declined location" });
    await field.saveAnswers(iv, { C01: { value: true }, R01: { value: "official" }, R03: { value: true }, Q02: { value: 4 } });
    return iv;
  }

  it("submit needs an explicit interview-position state, drops hidden answers, stamps the time and is idempotent", async () => {
    const noPos = await draft(false);
    expect(await code(field.submit(noPos, ann, []))).toBe("cannot_submit");
    const iv = await draft();
    await field.saveAnswers(iv, { R01: { value: "resident" } });                         // R03 is now hidden
    expect(await field.submit(iv, ann, ["R03"])).toBe("submitted");
    const got = (await field.getInterview(iv))!;
    expect(got.status).toBe("submitted");
    expect(Object.keys(got.answers).sort()).toEqual(["C01", "Q02", "R01"]);
    expect((await admin.query("SELECT submitted_at FROM private.interviews WHERE id = $1", [iv])).rows[0].submitted_at).not.toBeNull();
    expect(await field.submit(iv, ann, [])).toBe("already_submitted");
  });

  it("only the collector submits; a submitted interview is frozen; the status cannot be forced by plain SQL", async () => {
    const iv = await draft();
    expect(await code(field.submit(iv, bob, []))).toBe("cannot_submit");
    expect(await code(app.query("UPDATE private.interviews SET status = 'submitted', submitted_at = now() WHERE id = $1", [iv]))).toBe("23001");
    await field.submit(iv, ann, []);
    expect(await code(field.saveAnswers(iv, { Q02: { value: 1 } }))).toBe("not_draft");
    expect(await code(field.recordPosition(iv, ann, { state: "denied", permissionState: "denied", reason: "x" }))).toBe("not_draft");
    expect(await code(app.query("UPDATE private.interviews SET submitted_at = now() - interval '1 day' WHERE id = $1", [iv]))).toBe("23001");
    expect(await code(app.query("UPDATE private.interviews SET status = 'draft' WHERE id = $1", [iv]))).toBe("23001");
  });

  it("consent withdrawn before submit blocks submission; withdrawal after submit still discards content", async () => {
    const a = await draft();
    await consent.record({ interviewId: a, studyAreaId: AREA, scope: "participation", decision: "withdrawn", scriptVersionId: script, language: "en", actorId: ann });
    expect(await code(field.submit(a, ann, []))).toBe("cannot_submit");
    const b = await draft();
    await field.submit(b, ann, []);
    await consent.record({ interviewId: b, studyAreaId: AREA, scope: "participation", decision: "withdrawn", scriptVersionId: script, language: "en", actorId: ann });
    const after = (await field.getInterview(b))!;
    expect([after.status, after.answers]).toEqual(["withdrawn", {}]);
    expect((await admin.query("SELECT count(*)::int AS n FROM private.interview_positions WHERE interview_id = $1", [b])).rows[0].n).toBe(0);
  });

  it("review decisions: never the collector, only for a submitted interview, append-only, final once approved or rejected", async () => {
    const iv = await draft();
    expect(await code(field.decideReview(iv, bob, "approved"))).toBe("review_refused");                 // still a draft
    await field.submit(iv, ann, []);
    expect(await code(app.query("INSERT INTO private.interview_reviews (interview_id, decision, reviewer_id) VALUES ($1,'approved',$2)", [iv, bob]))).toBe("42501");   // not by the API role
    const asAdmin = new PgFieldRepository(admin);
    expect(await code(asAdmin.decideReview(iv, ann, "approved"))).toBe("review_refused");                // own interview
    await asAdmin.decideReview(iv, bob, "changes_requested", "please check Q02");
    expect((await admin.query("SELECT review_status FROM private.interview_review_status WHERE interview_id = $1", [iv])).rows[0].review_status).toBe("changes_requested");
    await asAdmin.decideReview(iv, cat, "approved");
    expect(await code(asAdmin.decideReview(iv, bob, "rejected"))).toBe("review_refused");                // already decided
    expect(await code(admin.query("UPDATE private.interview_reviews SET decision = 'rejected'"))).toBe("23001");
    expect(await code(admin.query("DELETE FROM private.interview_reviews"))).toBe("23001");
    expect((await admin.query("SELECT review_status FROM private.interview_review_status WHERE interview_id = $1", [iv])).rows[0].review_status).toBe("approved");
  });

  it("own submission history lists only the collector's interviews in the study, newest first, with review status", async () => {
    const a = await draft(); await field.submit(a, ann, []);
    const b = await draft();
    await new PgFieldRepository(admin).decideReview(a, bob, "approved");
    const mine = await field.submissions(ann, AREA);
    expect(mine.map((x) => [x.id, x.status, x.reviewStatus])).toEqual(expect.arrayContaining([[a, "submitted", "approved"], [b, "draft", null]]));
    expect(await field.submissions(bob, AREA)).toEqual([]);
    expect(await field.submissions(ann, "00000000-0000-4000-8000-0000000000a2")).toEqual([]);
  });

  it("the function cannot be called by the public role", async () => {
    const pubc = new pg.Client({ connectionString: url }); await pubc.connect(); await pubc.query("SET ROLE makarba_public_api");
    expect(await code(pubc.query("SELECT private.submit_interview($1, $2, '{}')", [randomUUID(), ann]))).toBe("42501");
    await pubc.end();
  });
});
