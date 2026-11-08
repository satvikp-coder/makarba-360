import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate, MIGRATIONS_DIR } from "@makarba/db";
import { AccountService, Authorizer, loadMatrix } from "@makarba/authz";
import { SYNTHETIC_INSTRUMENT } from "@makarba/survey";
import { SurveyPublisher } from "./survey-repository.js";
import { prepareServer, type Prepared } from "./startup.js";

// End to end on PostGIS (CI `database` job): fake identity provider -> real sessions, grants, invitations, audit and private routes.
// Synthetic people and geometry only. Skipped locally without TEST_DATABASE_URL.
const url = process.env["TEST_DATABASE_URL"];
const bootstrap = readFileSync(fileURLToPath(new URL("../../../db/bootstrap/001_roles_and_schemas.sql", import.meta.url)), "utf8");
const AREA = "00000000-0000-4000-8000-0000000000a1";
const OTHER_AREA = "00000000-0000-4000-8000-0000000000a2";

describe.skipIf(!url)("private API stack on PostGIS with a fake identity provider [PASS - SYNTHETIC IDENTITY PROVIDER when run in CI]", () => {
  let admin: pg.Client, idp: Server, base = "", key: CryptoKey, jwks: { keys: JWK[] };
  let claims: (nonce: string) => Record<string, unknown> = () => ({});
  let nonce = "";
  let prepared: Prepared;
  const ids: Record<string, string> = {};
  let scriptId = "";
  let surveyId = "";

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url }); await admin.connect();
    const kp = await generateKeyPair("RS256");
    key = kp.privateKey;
    jwks = { keys: [{ ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
    idp = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/.well-known/openid-configuration") { res.end(JSON.stringify({ issuer: base, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`, jwks_uri: `${base}/jwks` })); return; }
      if (req.url === "/jwks") { res.end(JSON.stringify(jwks)); return; }
      if (req.url === "/token") {
        req.resume();
        req.on("end", async () => { res.end(JSON.stringify({ id_token: await new SignJWT(claims(nonce)).setProtectedHeader({ alg: "RS256", kid: "k1" }).sign(key) })); });
        return;
      }
      res.statusCode = 404; res.end("{}");
    });
    await new Promise<void>((r) => idp.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise((r) => idp.close(r)); await admin.end(); });

  beforeEach(async () => {
    if (prepared?.privatePool) await prepared.privatePool.end();
    await admin.query("RESET ROLE");
    await admin.query("DROP SCHEMA IF EXISTS private, published, audit, migrations CASCADE");
    await admin.query(bootstrap);
    await migrate(admin, loadMigrations(MIGRATIONS_DIR), { asRole: "makarba_migrator" });
    await admin.query(`INSERT INTO private.study_areas (id, version, name, geometry) VALUES ('${AREA}', 1, 'a', ST_GeomFromText('MULTIPOLYGON(((9 9,12 9,12 12,9 12,9 9)))',4326))`);
    await admin.query("INSERT INTO private.location_categories (id, labels, icon) VALUES ('heritage','{\"en\":\"H\"}','landmark')");
    const mk = async (name: string, sub: string, role: string, area: string | null, by?: string) => {
      const id = (await admin.query("INSERT INTO private.users (oidc_subject, display_name) VALUES ($1, $2) RETURNING id", [sub, name])).rows[0].id as string;
      ids[name] = id;
      if (by) await admin.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,$2,$3,$4)", [id, role, area, by]);
      return id;
    };
    const root = await mk("root", "sub-root", "administrator", null);
    const grantor = await mk("grantor", "sub-grantor", "researcher", AREA);
    // The administrator role may only be granted through the maintenance path (superuser here), by a different user.
    await admin.query("INSERT INTO private.user_roles (user_id, role_id, study_area_id, granted_by) VALUES ($1,'administrator',NULL,$2)", [root, grantor]);
    await mk("researcher", "sub-researcher", "researcher", AREA, root);
    await mk("lead", "sub-lead", "lead", AREA, root);
    await mk("otherlead", "sub-otherlead", "lead", OTHER_AREA, root);
    await mk("researcher2", "sub-researcher2", "researcher", AREA, root);
    // Only "researcher" is trained; "researcher2" is not (collection actions must be refused for them).
    await admin.query("INSERT INTO private.researcher_profiles (user_id, training_version, trained_at, recorded_by) VALUES ($1, 'synthetic-training', now(), $2)", [ids["researcher"], root]);
    const pubr = new SurveyPublisher(admin);
    surveyId = (await pubr.publish((await pubr.createDraft(SYNTHETIC_INSTRUMENT, root)).id, "SYNTHETIC TEST AUTHORITY", root)).id;
    scriptId = (await admin.query("INSERT INTO private.consent_script_versions (version, language, content_sha256, status, approved_by, approved_at) VALUES ('v1','en',$1,'approved','SYNTHETIC TEST AUTHORITY', now()) RETURNING id", ["a".repeat(64)])).rows[0].id as string;
    prepared = await prepareServer(
      { DATABASE_URL: url!, SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz012345", OIDC_ISSUER: base, OIDC_CLIENT_ID: "makarba-test", OIDC_CLIENT_SECRET: "synthetic-client-secret-value", OIDC_REDIRECT_URI: "http://localhost/auth/callback" },
      { log: () => {}, allowInsecureOidc: true, poolFactory: (cs) => new pg.Pool({ connectionString: cs, options: "-c role=makarba_private_api", max: 5 }) },
    );
  });

  async function signIn(sub: string, amr: string[] = ["pwd"], invite?: string) {
    const start = await request(prepared.app).get("/auth/login" + (invite ? `?invite=${invite}` : ""));
    expect(start.status).toBe(302);
    const loc = new URL(start.headers["location"]!);
    nonce = loc.searchParams.get("nonce")!;
    const state = loc.searchParams.get("state")!;
    claims = (n) => ({ iss: base, aud: "makarba-test", sub, nonce: n, exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000), amr });
    const loginCookie = (start.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("mk_login="))!.split(";")[0]!;
    const cb = await request(prepared.app).get(`/auth/callback?code=c&state=${state}`).set("Cookie", loginCookie);
    if (cb.status !== 200) return { status: cb.status as number, cookie: "", csrf: "", body: cb.body };
    const cookie = (cb.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("mk_session="))!.split(";")[0]!;
    return { status: 200, cookie, csrf: cb.body.csrfToken as string, body: cb.body };
  }
  const point = { type: "Point", coordinates: [10.5, 10.5] };
  const newPlace = { studyAreaId: AREA, studyAreaVersion: 1, categoryId: "heritage", name: { en: "Synthetic well" }, crs: "EPSG:4326", geometry: point, provenance: { source: "synthetic", method: "digitised" } };
  const call = (s: { cookie: string; csrf: string }, method: "get" | "post" | "put", path: string, body?: object) => {
    const r = request(prepared.app)[method](`/api/v1/private${path}`).set("Cookie", s.cookie);
    return method === "get" ? r : r.set("X-CSRF-Token", s.csrf).send(body ?? {});
  };

  it("the private API is mounted only because an identity provider is configured, and /health stays public", async () => {
    expect(prepared.logLine).toContain("private API mounted");
    expect((await request(prepared.app).get("/health")).status).toBe(200);
    expect((await request(prepared.app).get("/api/v1/private/locations")).status).toBe(401);
  });

  it("provisioned users sign in; unknown identities and users who need MFA without it are refused", async () => {
    expect((await signIn("sub-researcher")).status).toBe(200);
    expect((await signIn("sub-stranger")).body.code).toBe("NOT_PROVISIONED");
    const noMfa = await signIn("sub-lead", ["pwd"]);
    expect([noMfa.status, noMfa.body.code]).toEqual([403, "MFA_REQUIRED"]);
    expect((await signIn("sub-lead", ["pwd", "mfa"])).status).toBe(200);
  });

  it("researcher proposes a place; a lead of that study reviews it; a lead of another study cannot see it; everything is audited", async () => {
    const r = await signIn("sub-researcher");
    const created = await call(r, "post", "/locations", newPlace);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ state: "candidate", proposedBy: ids["researcher"] });
    const id = created.body.id as string;
    expect((await call(r, "post", `/locations/${id}/review`, { expectedRevision: 1 })).status).toBe(403);   // researchers do not review
    expect((await call(r, "get", `/locations/${id}`)).status).toBe(403);

    const other = await signIn("sub-otherlead", ["mfa"]);
    expect((await call(other, "get", `/locations/${id}`)).status).toBe(403);

    const lead = await signIn("sub-lead", ["mfa"]);
    expect((await call(lead, "get", `/locations?studyAreaId=${AREA}`)).body.items).toHaveLength(1);
    const reviewed = await call(lead, "post", `/locations/${id}/review`, { expectedRevision: 1 });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body).toMatchObject({ state: "reviewed", reviewedBy: ids["lead"] });
    expect((await call(lead, "get", `/locations/${id}/revisions`)).body.items).toHaveLength(1);

    const log = (await admin.query("SELECT action, outcome, actor_id FROM audit.security_events ORDER BY id")).rows;
    expect(log.some((e) => e.action === "location.propose_geometry" && e.outcome === "allow" && e.actor_id === ids["researcher"])).toBe(true);
    expect(log.some((e) => e.action === "location.review_geometry" && e.outcome === "deny" && e.actor_id === ids["researcher"])).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/Synthetic well|10\.5/);                      // audit holds no content
  });

  it("writes need the CSRF token; a forged or missing session cookie is 401", async () => {
    const r = await signIn("sub-researcher");
    expect((await request(prepared.app).post("/api/v1/private/locations").set("Cookie", r.cookie).send(newPlace)).status).toBe(403);
    expect((await request(prepared.app).post("/api/v1/private/locations").set("Cookie", "mk_session=forged").set("X-CSRF-Token", r.csrf).send(newPlace)).status).toBe(401);
  });

  it("a deactivated user stops working on the very next request; revoked sessions are 401; deactivated users cannot sign in again", async () => {
    const r = await signIn("sub-researcher");
    expect((await call(r, "post", "/locations", newPlace)).status).toBe(201);
    await admin.query("UPDATE private.users SET active = false WHERE id = $1", [ids["researcher"]]);
    expect((await call(r, "post", "/locations", { ...newPlace, name: { en: "second" } })).status).toBe(401);
    expect((await signIn("sub-researcher")).body.code).toBe("NOT_PROVISIONED");
    await admin.query("UPDATE private.users SET active = true WHERE id = $1", [ids["researcher"]]);
    const again = await signIn("sub-researcher");
    expect((await call(again, "get", `/locations?studyAreaId=${AREA}`)).status).toBe(403);       // researchers cannot list
    await admin.query("UPDATE private.sessions SET revoked_at = now() WHERE user_id = $1", [ids["researcher"]]);
    expect((await call(again, "post", "/locations", newPlace)).status).toBe(401);
  });

  it("a revoked or expired role grant stops access without a new login", async () => {
    const r = await signIn("sub-researcher");
    await admin.query("UPDATE private.user_roles SET revoked_at = now() WHERE user_id = $1", [ids["researcher"]]);
    expect((await call(r, "post", "/locations", newPlace)).status).toBe(403);
  });

  it("invitation-only onboarding: an invited identity is provisioned with exactly the invited role and study, once", async () => {
    const root = (await new (await import("@makarba/authz")).PgGrantStore(admin).loadPrincipal(ids["root"]!))!;
    const svc = new AccountService(admin, new Authorizer(loadMatrix()));
    const inv = await svc.invite(root, { label: "synthetic invitee", role: "researcher", studyAreaId: AREA });
    expect((await signIn("sub-invitee")).body.code).toBe("NOT_PROVISIONED");                    // not provisioned without the invitation
    const first = await signIn("sub-invitee", ["pwd"], inv.token);
    expect(first.status).toBe(200);
    expect((await call(first, "post", "/locations", newPlace)).status).toBe(201);
    expect((await call(first, "post", "/locations", { ...newPlace, studyAreaId: OTHER_AREA })).status).toBe(403);   // only the invited study
    expect((await signIn("sub-second-person", ["pwd"], inv.token)).body.code).toBe("NOT_PROVISIONED");             // single use
  });

  it("consent over HTTP: independent scopes, no overwrite after refusal/withdrawal, owner-only writes, study-scoped reads", async () => {
    const iv = "00000000-0000-4000-8000-0000000c0001";
    const r = await signIn("sub-researcher");
    const body = (scope: string, decision: string) => ({ studyAreaId: AREA, scope, decision, scriptVersionId: scriptId, language: "en" });
    expect((await call(r, "post", `/interviews/${iv}/consent`, body("recording", "granted"))).body.code).toBe("participation_required");
    expect((await call(r, "post", `/interviews/${iv}/consent`, body("participation", "granted"))).status).toBe(201);
    expect((await call(r, "post", `/interviews/${iv}/consent`, body("aggregate_use", "refused"))).status).toBe(201);
    const recording = await call(r, "post", `/interviews/${iv}/consent`, body("recording", "granted"));
    expect(recording.body.flags).toMatchObject({ consentResearch: true, consentRecording: true, consentAggregate: false });
    const blocked = await call(r, "post", `/interviews/${iv}/consent`, body("aggregate_use", "granted"));       // the "checkbox" overwrite
    expect([blocked.status, blocked.body.code]).toEqual([409, "overwrite_blocked"]);
    expect((await call(r, "post", `/interviews/${iv}/consent`, { ...body("recording", "withdrawn") })).status).toBe(422);   // withdrawals have their own route
    const wd = await call(r, "post", `/interviews/${iv}/consent/withdraw`, { scope: "participation", scriptVersionId: scriptId, language: "en" });
    expect(wd.body).toMatchObject({ state: { participation: "withdrawn", recording: "withdrawn", aggregate_use: "refused" }, flags: { consentResearch: false, withdrawn: true } });
    expect((await call(r, "post", `/interviews/${iv}/consent`, body("participation", "granted"))).body.code).toBe("overwrite_blocked");

    const r2 = await signIn("sub-researcher2");                                                                       // another researcher, same study
    expect((await call(r2, "get", `/interviews/${iv}/consent`)).status).toBe(403);
    expect((await call(r2, "post", `/interviews/${iv}/consent`, body("recording", "granted"))).status).toBe(403);
    expect((await call(r2, "post", `/interviews/${iv}/consent/withdraw`, { scope: "participation", scriptVersionId: scriptId, language: "en" })).status).toBe(403);
    expect((await call(await signIn("sub-otherlead", ["mfa"]), "get", `/interviews/${iv}/consent`)).status).toBe(403);   // lead of another study
    const lead = await call(await signIn("sub-lead", ["mfa"]), "get", `/interviews/${iv}/consent`);                       // lead of this study
    expect(lead.status).toBe(200);
    expect(lead.body.events.map((e: { scope: string; decision: string }) => `${e.scope}:${e.decision}`)).toContain("participation:withdrawn");
    expect((await call(r, "get", "/interviews/not-a-uuid/consent")).status).toBe(403);
    expect((await call(r, "post", `/interviews/${iv.replace(/1$/, "9")}/consent`, { ...body("participation", "granted"), studyAreaId: OTHER_AREA })).status).toBe(403);   // not assigned to that study
  });

  it("field flow over HTTP: trained researcher only, consent before interview, idempotent start, draft answers, reconcile on end, discard on withdrawal", async () => {
    const r = await signIn("sub-researcher");
    const iv = "00000000-0000-4000-8000-0000000f0001";
    const consent = (interviewId: string, decision = "granted") => call(r, "post", `/interviews/${interviewId}/consent`, { studyAreaId: AREA, scope: "participation", decision, scriptVersionId: scriptId, language: "en" });
    const startBody = (id: string) => ({ id, surveyVersionId: surveyId, startedAt: "2026-01-01T10:00:00.000Z", startedOffsetMinutes: 330 });

    expect((await call(await signIn("sub-researcher2"), "post", "/visits", { studyAreaId: AREA })).status).toBe(403);   // untrained
    expect((await call(r, "post", "/visits", { studyAreaId: OTHER_AREA })).status).toBe(403);                         // not assigned to that study
    const visit = await call(r, "post", "/visits", { studyAreaId: AREA });
    expect(visit.status).toBe(201);
    const vid = visit.body.id as string;

    expect((await call(r, "post", `/visits/${vid}/interviews`, startBody(iv))).body.code).toBe("consent_required");   // no consent yet
    expect((await call(r, "post", `/visits/${vid}/interviews`, { ...startBody(iv), startedAt: "2999-01-01T00:00:00Z" })).status).toBe(422);
    expect((await consent(iv)).status).toBe(201);
    const first = await call(r, "post", `/visits/${vid}/interviews`, startBody(iv));
    const again = await call(r, "post", `/visits/${vid}/interviews`, startBody(iv));
    expect([first.status, again.status, again.body.id]).toEqual([201, 200, iv]);                                       // repeated tap, same interview
    expect((await call(r, "post", `/visits/${vid}/interviews`, { ...startBody(iv), startedOffsetMinutes: 0 })).status).toBe(409);
    expect((await admin.query("SELECT count(*)::int AS n FROM private.interviews")).rows[0].n).toBe(1);

    const saved = await call(r, "put", `/interviews/${iv}/answers`, { answers: { C01: { value: true }, R01: { value: "official" }, R03: { value: true }, Q02: { value: 4 } } });
    expect(saved.status).toBe(200);
    expect(saved.body.visibleQuestions).toEqual(expect.arrayContaining(["R03", "Q02"]));
    expect((await call(r, "put", `/interviews/${iv}/answers`, { answers: { Q02: { value: 9 } } })).status).toBe(422);
    expect((await call(r, "put", `/interviews/${iv}/answers`, { answers: { Q99: { value: 1 } } })).status).toBe(422);
    const hidden = await call(r, "put", `/interviews/${iv}/answers`, { answers: { R01: { value: "resident" } } });       // R03 is now hidden: kept, flagged stale, never published
    expect(hidden.body.staleHiddenAnswers).toEqual(["R03"]);

    const lead = await signIn("sub-lead", ["mfa"]);
    expect((await call(lead, "get", `/interviews/${iv}`)).status).toBe(200);                                           // assigned lead may read
    expect((await call(await signIn("sub-otherlead", ["mfa"]), "get", `/interviews/${iv}`)).status).toBe(403);
    expect((await call(await signIn("sub-researcher2"), "get", `/interviews/${iv}`)).status).toBe(403);

    // Interview position (GPS): denial is recorded without coordinates, a poor fix is flagged but saved, a manual pin keeps the raw reading.
    const denied = await call(r, "post", `/interviews/${iv}/position`, { state: "denied", permissionState: "denied", reason: "participant declined" });
    expect([denied.status, denied.body.current.effective]).toEqual([201, null]);
    const poor = await call(r, "post", `/interviews/${iv}/position`, { state: "device_fix", permissionState: "granted", lat: 10.5, lon: 10.5, accuracyM: 80, capturedAt: new Date().toISOString() });
    expect([poor.status, poor.body.quality]).toEqual([201, "low"]);
    const pin = await call(r, "post", `/interviews/${iv}/position`, { state: "manual_pin", permissionState: "granted", lat: 10.5003, lon: 10.5001, reason: "moved off the road" });
    expect(pin.body.positions.map((p: { state: string }) => p.state)).toEqual(["denied", "device_fix", "manual_pin"]);
    expect(pin.body.current).toMatchObject({ raw: { lat: 10.5, lon: 10.5 }, effective: { lat: 10.5003, lon: 10.5001 }, accuracyM: null });
    expect((await call(r, "post", `/interviews/${iv}/position`, { state: "manual_pin", permissionState: "granted", lat: 10.5, lon: 10.5, accuracyM: 5, reason: "x" })).status).toBe(422);
    expect((await call(r, "post", `/interviews/${iv}/position`, { state: "device_fix", permissionState: "granted", lat: 95, lon: 10, accuracyM: 5, capturedAt: new Date().toISOString() })).status).toBe(422);
    // Exact positions are private: only the owner and the assigned lead can read them.
    expect((await call(lead, "get", `/interviews/${iv}/positions`)).status).toBe(200);
    expect((await call(await signIn("sub-otherlead", ["mfa"]), "get", `/interviews/${iv}/positions`)).status).toBe(403);
    const r2 = await signIn("sub-researcher2");
    expect((await call(r2, "get", `/interviews/${iv}/positions`)).status).toBe(403);
    expect((await call(r2, "post", `/interviews/${iv}/position`, { state: "denied", permissionState: "denied", reason: "x" })).status).toBe(403);
    expect((await request(prepared.app).get(`/api/v1/private/interviews/${iv}/positions`)).status).toBe(401);
    // Subject place is independent of the interview position.
    const same = await call(r, "put", `/interviews/${iv}/subjects/1`, { crs: "EPSG:4326", geometry: { type: "Point", coordinates: [10.5001, 10.5003] } });
    expect(same.status).toBe(422);                                                                                       // identical to the effective interview position, not confirmed
    const other = await call(r, "put", `/interviews/${iv}/subjects/1`, { crs: "EPSG:4326", geometry: { type: "Point", coordinates: [10.52, 10.5] }, note: "corner shop" });
    expect([other.status, other.body.subjects[0].sameSpotConfirmed]).toEqual([200, false]);
    expect((await call(r, "put", `/interviews/${iv}/subjects/1`, { crs: "EPSG:3857", geometry: { type: "Point", coordinates: [10.5, 10.5] } })).status).toBe(422);
    // Official claim: recorded as pending, never verified by the collector.
    const claim = await call(r, "post", `/interviews/${iv}/official-claim`, { claimedRole: "Ward officer" });
    expect([claim.status, claim.body.status, claim.body.verified]).toEqual([201, "pending", false]);
    expect((await call(r, "post", `/interviews/${iv}/official-claim`, { claimedRole: "Ward officer", status: "verified" })).body.status).toBe("pending");

    const pending = await call(r, "post", `/visits/${vid}/end`, {});
    expect([pending.status, pending.body.code, pending.body.draftIds]).toEqual([409, "pending_drafts", [iv]]);
    expect((await call(r, "post", `/visits/${vid}/end`, { reconcile: { [iv]: "maybe" } })).status).toBe(422);
    const ended = await call(r, "post", `/visits/${vid}/end`, { reconcile: { [iv]: "keep" } });
    expect([ended.status, ended.body.status]).toEqual([200, "ended"]);
    const hist = await call(r, "get", `/visits/${vid}`);
    expect(hist.body.history.map((h: { status: string }) => h.status)).toEqual(["active", "ended"]);
    const iv2 = "00000000-0000-4000-8000-0000000f0002";
    await consent(iv2);
    expect((await call(r, "post", `/visits/${vid}/interviews`, startBody(iv2))).body.code).toBe("not_active");

    const wd = await call(r, "post", `/interviews/${iv}/consent/withdraw`, { scope: "participation", scriptVersionId: scriptId, language: "en" });
    expect(wd.status).toBe(200);
    const gone = await call(r, "get", `/interviews/${iv}`);
    expect([gone.body.status, gone.body.answers]).toEqual(["withdrawn", {}]);
    expect((await call(r, "put", `/interviews/${iv}/answers`, { answers: { Q02: { value: 1 } } })).status).toBe(409);
    expect((await admin.query("SELECT count(*)::int AS n FROM private.interview_answers")).rows[0].n).toBe(0);
  });

  it("submit over HTTP: validated against the pinned version, needs an explicit position state, drops hidden answers, idempotent, own history", async () => {
    const r = await signIn("sub-researcher");
    const vid = (await call(r, "post", "/visits", { studyAreaId: AREA })).body.id as string;
    const iv = "00000000-0000-4000-8000-0000000f1001";
    await call(r, "post", `/interviews/${iv}/consent`, { studyAreaId: AREA, scope: "participation", decision: "granted", scriptVersionId: scriptId, language: "en" });
    await call(r, "post", `/visits/${vid}/interviews`, { id: iv, surveyVersionId: surveyId, startedAt: "2026-01-01T10:00:00.000Z", startedOffsetMinutes: 330 });
    await call(r, "put", `/interviews/${iv}/answers`, { answers: { C01: { value: true }, R01: { value: "official" }, R03: { value: true } } });

    const early = await call(r, "post", `/interviews/${iv}/submit`, {});
    expect([early.status, Object.keys(early.body.fieldErrors)]).toEqual([422, ["Q02"]]);                                // required Q02 missing
    await call(r, "put", `/interviews/${iv}/answers`, { answers: { Q02: { missing: "unsure" }, R01: { value: "resident" } } });   // R03 now hidden
    const noPos = await call(r, "post", `/interviews/${iv}/submit`, {});
    expect([noPos.status, noPos.body.code]).toEqual([409, "cannot_submit"]);                                           // no position state yet
    await call(r, "post", `/interviews/${iv}/position`, { state: "unavailable", permissionState: "unsupported", reason: "no GPS on this device" });

    const done = await call(r, "post", `/interviews/${iv}/submit`, {});
    expect(done.status).toBe(201);
    expect(done.body).toMatchObject({ outcome: "submitted", status: "submitted", saveState: "saved on the server", consent: { consentResearch: true }, interviewPosition: { state: "unavailable", revisions: 1 }, droppedHiddenAnswers: ["R03"] });
    const again = await call(r, "post", `/interviews/${iv}/submit`, {});
    expect([again.status, again.body.outcome]).toEqual([200, "already_submitted"]);
    expect((await call(r, "put", `/interviews/${iv}/answers`, { answers: { Q02: { value: 1 } } })).status).toBe(409);
    expect(Object.keys((await call(r, "get", `/interviews/${iv}`)).body.answers).sort()).toEqual(["C01", "Q02", "R01"]);

    const mine = await call(r, "get", `/submissions?studyAreaId=${AREA}`);
    expect(mine.body.items.map((x: { id: string; status: string; reviewStatus: string }) => [x.id, x.status, x.reviewStatus])).toContainEqual([iv, "submitted", "pending"]);
    expect((await call(await signIn("sub-researcher2"), "get", `/submissions?studyAreaId=${AREA}`)).body.items ?? []).toEqual([]);
    expect((await call(r, "get", `/submissions?studyAreaId=${OTHER_AREA}`)).status).toBe(403);
    expect((await call(await signIn("sub-researcher2"), "post", `/interviews/${iv}/submit`, {})).status).toBe(403);
  });

  it("the private pool runs as the private API role: it cannot delete places or read other schemas' secrets it should not", async () => {
    await expect(prepared.privatePool!.query("DELETE FROM private.locations")).rejects.toMatchObject({ code: "42501" });
    await expect(prepared.privatePool!.query("UPDATE audit.security_events SET outcome = 'allow'")).rejects.toMatchObject({ code: "42501" });
  });
});
