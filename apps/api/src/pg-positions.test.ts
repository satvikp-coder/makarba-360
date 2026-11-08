import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { SYNTHETIC_INSTRUMENT, type PositionInput } from "@makarba/survey";
import { PgConsentRepository } from "./consent-repository.js";
import { FieldRepoError, PgFieldRepository } from "./field-repository.js";
import { SurveyPublisher } from "./survey-repository.js";

// CI `database` job on real PostGIS (skipped locally without TEST_DATABASE_URL). Synthetic people and coordinates around (10,10) only.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";
const fix = (lon: number, lat: number, accuracyM = 12): PositionInput => ({ state: "device_fix", permissionState: "granted", lon, lat, accuracyM, capturedAt: new Date().toISOString() });
const pt = (lon: number, lat: number) => ({ type: "Point", coordinates: [lon, lat] });

describe.skipIf(!url)("interview position, subject places and official claims in PostGIS (issues #46, #48-#50) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, field: PgFieldRepository, consent: PgConsentRepository;
  let ann: string, bob: string, iv: string, script: string, locationId: string;
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
    const survey = (await pub.publish((await pub.createDraft(SYNTHETIC_INSTRUMENT, null)).id, "SYNTHETIC TEST AUTHORITY", null)).id;
    script = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256, status, approved_by, approved_at) VALUES ('v1','en',$1,'approved','SYNTHETIC TEST AUTHORITY', now()) RETURNING id", ["a".repeat(64)])).rows[0].id;
    await admin.query(`INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('${AREA}', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((9 9,12 9,12 12,9 12,9 9)))',4326))`);
    await admin.query("INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark')");
    locationId = (await admin.query(`INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry) VALUES (gen_random_uuid(), '${AREA}', 1, 'heritage', '{"en":"x"}', ST_SetSRID(ST_MakePoint(10.9,10.9),4326)) RETURNING id`)).rows[0].id;
    await app.query("RESET ROLE"); await app.query("SET ROLE makarba_private_api");
    field = new PgFieldRepository(app); consent = new PgConsentRepository(app);
    const visit = await field.startVisit(ann, AREA);
    iv = randomUUID();
    await consent.record({ interviewId: iv, studyAreaId: AREA, scope: "participation", decision: "granted", scriptVersionId: script, language: "en", actorId: ann });
    await field.startInterview({ id: iv, visitId: visit.id, collectorId: ann, studyAreaId: AREA, surveyVersionId: survey, startedAt: "2026-01-01T10:00:00.000Z", startedOffsetMinutes: 330 });
  });
  const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof FieldRepoError ? e.code : (e as { code?: string }).code ?? "error"));

  it("a device fix keeps raw and effective together; a manual correction is a NEW revision that preserves the raw reading", async () => {
    await field.recordPosition(iv, ann, fix(10.5, 10.5, 12));
    await field.recordPosition(iv, ann, { state: "manual_pin", permissionState: "granted", lon: 10.5004, lat: 10.5002, reason: "moved off the road" });
    const p = await field.positions(iv);
    expect(p.map((x) => [x.revision, x.state])).toEqual([[1, "device_fix"], [2, "manual_pin"]]);
    expect(p[0]).toMatchObject({ raw: { lon: 10.5, lat: 10.5 }, effective: { lon: 10.5, lat: 10.5 }, accuracyM: 12 });
    expect(p[1]).toMatchObject({ raw: { lon: 10.5, lat: 10.5 }, effective: { lon: 10.5004, lat: 10.5002 }, accuracyM: null, reason: "moved off the road" });
  });

  it("denied and unavailable have no coordinates; recapture after a denial is allowed; the database refuses malformed shapes", async () => {
    await field.recordPosition(iv, ann, { state: "denied", permissionState: "denied", reason: "participant declined" });
    expect((await field.positions(iv))[0]).toMatchObject({ effective: null, raw: null, accuracyM: null });
    await field.recordPosition(iv, ann, fix(10.5, 10.5));
    expect((await field.positions(iv)).length).toBe(2);
    const row = (s: string) => `INSERT INTO private.interview_positions (interview_id, revision, state, permission_state, raw_geometry, geometry, accuracy_m, captured_at, reason, recorded_by) VALUES ('${iv}', 3, ${s}, '${ann}')`;
    expect(await code(app.query(row("'manual_pin','granted',NULL,ST_SetSRID(ST_MakePoint(10,10),4326),15,NULL,'x'")))).toBe("23514");      // invented accuracy
    expect(await code(app.query(row("'device_fix','denied',ST_SetSRID(ST_MakePoint(10,10),4326),ST_SetSRID(ST_MakePoint(10,10),4326),5,now(),NULL")))).toBe("23514");   // fix without permission
    expect(await code(app.query(row("'denied','denied',NULL,ST_SetSRID(ST_MakePoint(10,10),4326),NULL,NULL,'x'")))).toBe("23514");     // denied with a position
    expect(await code(app.query(row("'denied','denied',NULL,NULL,NULL,NULL,NULL")))).toBe("23514");                                     // no reason
    expect(await code(app.query(row("'device_fix','granted',ST_SetSRID(ST_MakePoint(500,10),4326),ST_SetSRID(ST_MakePoint(500,10),4326),5,now(),NULL")))).toBe("23514");   // out of range
  });

  it("positions are append-only for everyone; only the collecting researcher records them, and only while a draft", async () => {
    await field.recordPosition(iv, ann, fix(10.5, 10.5));
    expect(await code(app.query("UPDATE private.interview_positions SET accuracy_m = 1"))).toBe("42501");
    expect(await code(app.query("DELETE FROM private.interview_positions"))).toBe("42501");
    expect(await code(admin.query("UPDATE private.interview_positions SET accuracy_m = 1"))).toBe("23001");
    expect(await code(admin.query("DELETE FROM private.interview_positions"))).toBe("23001");
    expect(await code(admin.query("TRUNCATE private.interview_positions"))).toBe("23001");
    expect(await code(field.recordPosition(iv, bob, fix(10.6, 10.5)))).toBe("rejected_value");
    await app.query("UPDATE private.interviews SET status = 'abandoned' WHERE id = $1", [iv]);
    expect(await code(field.recordPosition(iv, ann, fix(10.6, 10.5)))).toBe("not_draft");
  });

  it("concurrent captures end with consecutive revisions, none lost", async () => {
    const other = new pg.Client({ connectionString: url }); await other.connect(); await other.query("SET ROLE makarba_private_api");
    const f2 = new PgFieldRepository(other);
    await Promise.all([field.recordPosition(iv, ann, fix(10.5, 10.5)), f2.recordPosition(iv, ann, fix(10.6, 10.5))]);
    await other.end();
    expect((await field.positions(iv)).map((x) => x.revision)).toEqual([1, 2]);
  });

  it("subject place: an existing place or its own candidate geometry, never silently copied from the interview position", async () => {
    await field.recordPosition(iv, ann, fix(10.5, 10.5));
    await field.setSubject(iv, 1, { locationId, sameSpotConfirmed: false });
    await field.setSubject(iv, 2, { candidateGeometry: pt(10.51, 10.5), note: "a corner shop", sameSpotConfirmed: false });
    expect(await code(field.setSubject(iv, 3, { candidateGeometry: pt(10.5, 10.5), sameSpotConfirmed: false }))).toBe("rejected_value");   // identical to the interview position
    expect(await code(field.setSubject(iv, 3, { candidateGeometry: pt(10.5, 10.5), sameSpotConfirmed: true }))).toBe("ok");                  // researcher says it is the same spot
    const s = await field.subjects(iv);
    expect(s.map((x) => [x.topicGroup, x.locationId ? "place" : "candidate", x.sameSpotConfirmed])).toEqual([[1, "place", false], [2, "candidate", false], [3, "candidate", true]]);
    await field.setSubject(iv, 2, { locationId, sameSpotConfirmed: false });                                                                   // same group again replaces
    expect((await field.subjects(iv)).length).toBe(3);
    expect(await code(app.query(`INSERT INTO private.subject_places (interview_id, topic_group, location_id, candidate_geometry) VALUES ('${iv}', 4, '${locationId}', ST_SetSRID(ST_MakePoint(10,10),4326))`))).toBe("23514");
    expect(await code(app.query(`INSERT INTO private.subject_places (interview_id, topic_group) VALUES ('${iv}', 5)`))).toBe("23514");
    expect(await code(field.setSubject(iv, 6, { candidateGeometry: { type: "MultiPolygon", coordinates: [[[[10, 10], [11, 11], [11, 10], [10, 11], [10, 10]]]] }, sameSpotConfirmed: false }))).toBe("rejected_value");   // self-intersecting
    expect(await code(field.setSubject(iv, 7, { locationId: randomUUID(), sameSpotConfirmed: false }))).toBe("rejected_value");              // no such place
  });

  it("the interview position is never stored in, or readable through, the subject table, and subject changes stop after the draft", async () => {
    await field.recordPosition(iv, ann, fix(10.5, 10.5));
    const cols = (await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'private' AND table_name = 'subject_places'")).rows.map((r) => r.column_name);
    expect(cols).not.toContain("interview_position");
    await app.query("UPDATE private.interviews SET status = 'abandoned' WHERE id = $1", [iv]);
    expect(await code(field.setSubject(iv, 1, { locationId, sameSpotConfirmed: false }))).toBe("not_draft");
  });

  it("official claims: always pending from the collector; a different person decides; only verified claims are attributable", async () => {
    expect(await field.recordClaim(iv, ann, "Ward officer")).toMatchObject({ status: "pending", created: true });
    expect(await field.recordClaim(iv, ann, "Ward officer")).toMatchObject({ status: "pending", created: false });         // repeat is harmless
    expect(await code(app.query("INSERT INTO private.official_claims (interview_id, claimed_role, status, claimed_by, verified_by, verified_at) SELECT gen_random_uuid(), 'x', 'verified', $1, $2, now()", [ann, bob]))).toBe("23001");
    expect(await code(app.query("UPDATE private.official_claims SET status = 'verified', verified_by = $1, verified_at = now()", [bob]))).toBe("42501");   // not by the API role
    expect((await admin.query("SELECT * FROM private.attributable_official_claims")).rows).toEqual([]);                      // pending is never attributable
    expect(await code(admin.query("UPDATE private.official_claims SET status = 'verified', verified_by = $1, verified_at = now()", [ann]))).toBe("23514");   // not the collector
    expect(await code(admin.query("UPDATE private.official_claims SET status = 'verified'"))).toBe("23514");                  // decision needs who and when
    expect(await code(admin.query("UPDATE private.official_claims SET status = 'verified', verified_by = $1, verified_at = now()", [bob]))).toBe("ok");
    expect((await admin.query("SELECT claimed_role FROM private.attributable_official_claims")).rows).toEqual([{ claimed_role: "Ward officer" }]);
    expect(await code(admin.query("UPDATE private.official_claims SET status = 'rejected'"))).toBe("23001");                  // decided claims are final
    expect(await code(admin.query("UPDATE private.official_claims SET claimed_role = 'Minister'"))).toBe("23001");
  });

  it("a claim cannot be inserted as already verified", async () => {
    expect(await code(admin.query("INSERT INTO private.official_claims (interview_id, claimed_role, status, claimed_by, verified_by, verified_at) VALUES ($1, 'x', 'verified', $2, $3, now())", [iv, ann, bob]))).toBe("23001");
  });

  it("withdrawing participation discards positions, subject places and claims, and the claim stops being attributable", async () => {
    await field.recordPosition(iv, ann, fix(10.5, 10.5));
    await field.setSubject(iv, 1, { locationId, sameSpotConfirmed: false });
    await field.recordClaim(iv, ann, "Ward officer");
    await consent.record({ interviewId: iv, studyAreaId: AREA, scope: "participation", decision: "withdrawn", scriptVersionId: script, language: "en", actorId: ann });
    for (const t of ["interview_positions", "subject_places", "official_claims", "interview_answers"]) expect((await admin.query(`SELECT count(*)::int AS n FROM private.${t}`)).rows[0].n, t).toBe(0);
    expect((await field.getInterview(iv))!.status).toBe("withdrawn");
  });

  it("the public API role can read none of it", async () => {
    const pubc = new pg.Client({ connectionString: url }); await pubc.connect(); await pubc.query("SET ROLE makarba_public_api");
    for (const t of ["interview_positions", "subject_places", "official_claims", "attributable_official_claims"]) expect(await code(pubc.query(`SELECT * FROM private.${t}`))).toBe("42501");
    await pubc.end();
  });
});
