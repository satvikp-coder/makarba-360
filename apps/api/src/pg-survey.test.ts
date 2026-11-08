import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { SYNTHETIC_INSTRUMENT, type Instrument } from "@makarba/survey";
import { instrumentHash, PgSurveyRepository, SurveyError, SurveyPublisher } from "./survey-repository.js";

// CI `database` job on real PostGIS (skipped locally without TEST_DATABASE_URL). The instrument is the SYNTHETIC test instrument.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const clone = (): Instrument => JSON.parse(JSON.stringify(SYNTHETIC_INSTRUMENT));

describe.skipIf(!url)("immutable questionnaire versions in PostGIS (issues #42, #43) [PASS - SYNTHETIC DATABASE when run in CI]", () => {
  let admin: pg.Client, app: pg.Client, publisher: SurveyPublisher, repo: PgSurveyRepository, user: string;
  beforeAll(async () => { admin = new pg.Client({ connectionString: url }); await admin.connect(); app = new pg.Client({ connectionString: url }); await app.connect(); });
  afterAll(async () => { await admin.end(); await app.end(); });
  beforeEach(async () => {
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    user = (await admin.query("INSERT INTO private.users (oidc_subject) VALUES ('sub-maint') RETURNING id")).rows[0].id;
    publisher = new SurveyPublisher(admin);
    await app.query("RESET ROLE"); await app.query("SET ROLE makarba_private_api");
    repo = new PgSurveyRepository(app);
  });
  const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof SurveyError ? e.code : (e as { code?: string }).code ?? "error"));

  it("a valid instrument becomes a draft, is published with its hash and a named authority, and is then readable by the API role", async () => {
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    expect(d.status).toBe("draft");
    expect(await code(repo.getUsable(d.id))).toBe("not_published");           // drafts cannot start interviews
    const p = await publisher.publish(d.id, "SYNTHETIC TEST AUTHORITY", user);
    expect(p).toMatchObject({ status: "published", sha256: instrumentHash(SYNTHETIC_INSTRUMENT), approvedBy: "SYNTHETIC TEST AUTHORITY" });
    expect((await repo.getUsable(d.id)).instrument).toEqual(SYNTHETIC_INSTRUMENT);
    expect((await repo.listPublished()).map((v) => v.code)).toEqual(["synthetic-v1"]);
  });

  it("an invalid instrument, a duplicate code and an empty authority are refused", async () => {
    const bad = clone(); bad.questions[1]!.showIf = { question: "Q99", op: "answered" };
    expect(await code(publisher.createDraft(bad, user))).toBe("invalid_instrument");
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    expect(await code(publisher.createDraft(SYNTHETIC_INSTRUMENT, user))).toBe("already_exists");
    expect(await code(publisher.publish(d.id, "  ", user))).toBe("rejected");
    expect((await repo.get(d.id))!.status).toBe("draft");
  });

  it("a published version cannot be edited, re-published, deleted or truncated - by anyone, including the owner", async () => {
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    await publisher.publish(d.id, "SYNTHETIC TEST AUTHORITY", user);
    const edited = JSON.stringify({ ...SYNTHETIC_INSTRUMENT, title: { en: "changed" } });
    expect(await code(admin.query("UPDATE private.survey_versions SET instrument = $2::jsonb WHERE id = $1", [d.id, edited]))).toBe("23001");
    expect(await code(admin.query("UPDATE private.survey_versions SET approved_by = 'someone else' WHERE id = $1", [d.id]))).toBe("23001");
    expect(await code(admin.query("UPDATE private.survey_versions SET status = 'draft' WHERE id = $1", [d.id]))).toBe("23001");
    expect(await code(admin.query("DELETE FROM private.survey_versions WHERE id = $1", [d.id]))).toBe("23001");
    expect(await code(admin.query("TRUNCATE private.survey_versions"))).toBe("23001");
    expect(await code(publisher.publish(d.id, "again", user))).toBe("rejected");
  });

  it("retiring is the only change allowed; a retired version is frozen and no longer usable", async () => {
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    await publisher.publish(d.id, "SYNTHETIC TEST AUTHORITY", user);
    await publisher.retire(d.id);
    expect(await code(repo.getUsable(d.id))).toBe("not_published");
    expect(await code(admin.query("UPDATE private.survey_versions SET status = 'published', retired_at = NULL WHERE id = $1", [d.id]))).toBe("23001");
    expect(await code(publisher.retire(d.id))).toBe("rejected");
    expect(await code(admin.query("UPDATE private.survey_versions SET status = 'retired', retired_at = now() WHERE code = 'nope'"))).toBe("ok");
  });

  it("a draft cannot skip publishing straight to retired, and a published row needs its hash and authority at the database level", async () => {
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    expect(await code(admin.query("UPDATE private.survey_versions SET status = 'retired', retired_at = now() WHERE id = $1", [d.id]))).toBe("23001");
    expect(await code(admin.query("UPDATE private.survey_versions SET status = 'published', published_at = now() WHERE id = $1", [d.id]))).toBe("23514");
  });

  it("the API role cannot create, publish or edit versions, and a row tampered with behind the app's back is refused when read", async () => {
    expect(await code(app.query("INSERT INTO private.survey_versions (code, instrument) VALUES ('x', '{\"questions\": []}')"))).toBe("42501");
    const d = await publisher.createDraft(SYNTHETIC_INSTRUMENT, user);
    expect(await code(app.query("UPDATE private.survey_versions SET status = 'published' WHERE id = $1", [d.id]))).toBe("42501");
    await publisher.publish(d.id, "SYNTHETIC TEST AUTHORITY", user);
    // Simulate a tampered store: disable the trigger as the superuser, change the wording, re-enable.
    await admin.query("ALTER TABLE private.survey_versions DISABLE TRIGGER survey_versions_guard");
    await admin.query("UPDATE private.survey_versions SET instrument = jsonb_set(instrument, '{title,en}', '\"tampered\"') WHERE id = $1", [d.id]);
    await admin.query("ALTER TABLE private.survey_versions ENABLE TRIGGER survey_versions_guard");
    expect(await code(repo.getUsable(d.id))).toBe("hash_mismatch");
  });

  it("the public API role cannot read questionnaire versions", async () => {
    const pub = new pg.Client({ connectionString: url }); await pub.connect(); await pub.query("SET ROLE makarba_public_api");
    expect(await code(pub.query("SELECT * FROM private.survey_versions"))).toBe("42501");
    await pub.end();
  });
});
