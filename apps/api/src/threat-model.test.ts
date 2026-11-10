import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemoryAuditSink } from "@makarba/audit";
import { MemorySessionStore, SessionService } from "@makarba/auth";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { findForbiddenField, validatePublic } from "@makarba/contracts";
import { createApp } from "./app.js";
import { mockRouter } from "./mock.js";
import { privateApi, type PrivateRoute } from "./private-routes.js";
import { notFound, safeErrors } from "./safe-errors.js";

/**
 * Abuse-case tests (#41). Each test title starts with an id from docs/architecture/threat-model.json, and the last tests check that
 * every registered case has a test. They run against the REAL private-API construction, authorizer and audit hook with in-memory
 * stores and synthetic people. The capability matrix is PROPOSED (issue #6), so these tests show the code enforces whatever matrix
 * it is given; they do not show the matrix is right. Cases that need services that do not exist yet (consent records #37,
 * raw-interview endpoints #38, media upload #60) are listed in the register as requiring live services.
 */
const authz = new Authorizer(loadMatrix());
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";
const U: Record<string, string> = Object.fromEntries(["res1","res2","untrained","lead1","leadX","adm","gone","expired","nobody"].map((k, i) => [k, `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`]));
const mk = (userId: string, role: Principal["grants"][number]["role"], studyAreaId: string | null, o: Partial<Principal> = {}): Principal =>
  ({ userId: U[userId]!, active: true, trained: true, grants: [{ role, studyAreaId, expiresAt: null }], ...o });
const byAlias: Record<string, Principal> = {
  res1: mk("res1", "researcher", S1), res2: mk("res2", "researcher", S1), untrained: mk("untrained", "researcher", S1, { trained: false }),
  lead1: mk("lead1", "lead", S1), leadX: mk("leadX", "lead", S2), adm: mk("adm", "administrator", null), gone: mk("gone", "lead", S1, { active: false }),
  expired: { userId: U["expired"]!, active: true, trained: true, grants: [{ role: "lead", studyAreaId: S1, expiresAt: new Date("2020-01-01") }] },
};
const people: Record<string, Principal> = Object.fromEntries(Object.entries(byAlias).map(([, p]) => [p.userId, p]));
const records: Record<string, { studyAreaId: string; ownerId: string; authorId: string }> = {
  mine: { studyAreaId: S1, ownerId: U["res1"]!, authorId: U["res1"]! },
  theirs: { studyAreaId: S1, ownerId: U["res2"]!, authorId: U["res2"]! },
  foreign: { studyAreaId: S2, ownerId: U["leadX"]!, authorId: U["leadX"]! },
  "by-lead": { studyAreaId: S1, ownerId: U["lead1"]!, authorId: U["lead1"]! },
};
const rec = (req: express.Request) => records[String(req.params["id"])] ?? {};
const ok: express.RequestHandler = (_q, r) => r.json({ data: "synthetic" });
const routes: PrivateRoute[] = [
  { method: "get", path: "/interviews/:id", action: "interview.view_private", resolve: rec, handler: ok },
  { method: "post", path: "/interviews/:id/correction", action: "interview.request_correction", resolve: rec, handler: ok },
  { method: "post", path: "/interviews", action: "interview.create", resolve: () => ({ studyAreaId: S1 }), handler: ok },
  { method: "post", path: "/content/:id/publish", action: "content.publish", resolve: rec, handler: ok },
  { method: "post", path: "/exports", action: "export.restricted", resolve: () => ({ studyAreaId: S1 }), handler: ok },
  { method: "get", path: "/users", action: "user.manage", handler: ok },
  { method: "get", path: "/audit", action: "audit.view", resolve: () => ({ studyAreaId: S1 }), handler: ok },
];

async function world(user?: string) {
  const sessions = new SessionService({ store: new MemorySessionStore() });
  const audit = new MemoryAuditSink();
  const app = express();
  app.use(express.json());
  app.use("/private", privateApi({ authz, sessions, routes, principals: { loadPrincipal: async (id) => people[id] ?? null }, audit: { sink: audit } }));
  app.use(notFound);
  app.use(safeErrors);
  const s = user ? await sessions.create(U[user] ?? user, true) : null;
  return { app, audit, cookie: s ? `mk_session=${s.token}` : "", csrf: s?.csrfToken ?? "" };
}
type W = Awaited<ReturnType<typeof world>>;
const send = (w: W, method: PrivateRoute["method"], path: string, csrf: string | null = w.csrf) => {
  const r = request(w.app)[method](`/private${path}`).set("Cookie", w.cookie);
  return method === "get" || csrf === null ? r : r.set("x-csrf-token", csrf);
};
const sample = (r: PrivateRoute) => r.path.replace(":id", "mine");

describe("AC-01 unauthenticated and invalid sessions", () => {
  it("AC-01 every private route answers 401 with no session, a garbage cookie, a wrong-length token or an unrelated cookie", async () => {
    const w = await world();
    for (const r of routes) {
      for (const cookie of ["", "mk_session=garbage", "mk_session=" + "A".repeat(64), "other=1"]) {
        const res = await request(w.app)[r.method](`/private${sample(r)}`).set("Cookie", cookie);
        expect(res.status, `${r.method} ${r.path} cookie=${cookie.slice(0, 15)}`).toBe(401);
        expect(JSON.stringify(res.body)).not.toMatch(/synthetic|stack/);
      }
    }
  });
  it("AC-01 a tampered session token (last character changed) is rejected", async () => {
    const w = await world("res1");
    const t = w.cookie.split("=")[1]!;
    const bad = `mk_session=${t.slice(0, -1)}${t.endsWith("A") ? "B" : "A"}`;
    expect((await request(w.app).get("/private/interviews/mine").set("Cookie", bad)).status).toBe(401);
  });
});

describe("AC-03 CSRF", () => {
  it("AC-03 every write route refuses a missing, empty, wrong or another user's CSRF token", async () => {
    const a = await world("res1");
    const b = await world("lead1");
    for (const r of routes.filter((x) => x.method !== "get")) {
      for (const [label, tok] of [["missing", null], ["empty", ""], ["wrong", "wrong"], ["other user", b.csrf]] as const) {
        expect((await send(a, r.method, sample(r), tok)).status, `${r.path} ${label}`).toBe(403);
      }
    }
  });
});

describe("AC-04 cross-record and cross-study access (IDOR)", () => {
  it("AC-04 a researcher cannot read another researcher's record; leads see only their own study", async () => {
    expect((await send(await world("res1"), "get", "/interviews/mine")).status).toBe(200);
    expect((await send(await world("res1"), "get", "/interviews/theirs")).status).toBe(403);
    expect((await send(await world("res1"), "get", "/interviews/foreign")).status).toBe(403);
    expect((await send(await world("leadX"), "get", "/interviews/mine")).status).toBe(403);
    expect((await send(await world("lead1"), "get", "/interviews/foreign")).status).toBe(403);
  });
  it("AC-04 the study and owner cannot be chosen by the client: query, header and body claims are ignored", async () => {
    const w = await world("leadX");
    const r = await request(w.app).get("/private/interviews/mine?studyAreaId=" + S2).set("Cookie", w.cookie).set("x-study-area-id", S2);
    expect(r.status).toBe(403);
    const c = await world("res1");
    const p = await request(c.app).post("/private/interviews/theirs/correction").set("Cookie", c.cookie).set("x-csrf-token", c.csrf).send({ ownerId: "res1", studyAreaId: S1 });
    expect(p.status).toBe(403);
  });
  it("AC-10 a record that does not exist and a record the caller may not see are indistinguishable", async () => {
    const w = await world("res1");
    const missing = await send(w, "get", "/interviews/does-not-exist");
    const foreign = await send(w, "get", "/interviews/foreign");
    expect([missing.status, missing.body]).toEqual([foreign.status, foreign.body]);
  });
});

describe("AC-05 privilege escalation", () => {
  it("AC-05 each role reaches only what the matrix gives it", async () => {
    const expectStatus = async (u: string, method: PrivateRoute["method"], path: string, status: number) =>
      expect((await send(await world(u), method, path)).status, `${u} ${method} ${path}`).toBe(status);
    await expectStatus("res1", "get", "/users", 403);
    await expectStatus("res1", "get", "/audit", 403);
    await expectStatus("res1", "post", "/exports", 403);
    await expectStatus("res1", "post", "/content/theirs/publish", 403);
    await expectStatus("lead1", "get", "/users", 403);
    await expectStatus("lead1", "get", "/audit", 200);
    await expectStatus("adm", "get", "/users", 200);
    await expectStatus("adm", "get", "/interviews/mine", 403);
    await expectStatus("adm", "post", "/exports", 403);
    await expectStatus("adm", "post", "/content/theirs/publish", 403);
  });
  it("AC-05 inactive users, expired grants and unknown users are refused even with a valid session", async () => {
    for (const u of ["gone", "expired", "nobody"]) expect((await send(await world(u), "get", "/audit")).status, u).toBe(403);
  });
  it("AC-05 untrained researchers cannot start collection", async () => {
    expect((await send(await world("untrained"), "post", "/interviews")).status).toBe(403);
    expect((await send(await world("res1"), "post", "/interviews")).status).toBe(200);
  });
});

describe("AC-06 valid authentication cannot bypass review", () => {
  it("AC-06 nobody can publish their own work, even with the publish capability; another person's work can be published", async () => {
    const w = await world("lead1");
    const own = await send(w, "post", "/content/by-lead/publish");
    expect(own.status).toBe(403);
    expect(own.body.message).toBe("You do not have access to this resource");     // does not say which rule failed
    expect((await send(w, "post", "/content/theirs/publish")).status).toBe(200);
  });
  it("AC-06 a record with no known author cannot be published (fail closed)", async () => {
    expect((await send(await world("lead1"), "post", "/content/unknown-author/publish")).status).toBe(403);
  });
});

describe("AC-07 raw positions and private fields never reach the public contract", () => {
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));
  it("AC-07 forbidden fields are rejected at any depth and in any spelling", () => {
    for (const k of ["interviewLatitude", "interview_longitude", "GPS-Accuracy-M", "researcherId", "rawAnswers", "participantName", "phone", "originalKey", "privateUrl", "consentRecords"]) {
      const v = JSON.parse(JSON.stringify(fixture.locations));
      v.features[0].properties[k] = 1;
      expect(validatePublic("locations", v).ok, k).toBe(false);
      expect(findForbiddenField({ a: [{ b: { [k]: 1 } }] }), `nested ${k}`).not.toBeNull();
    }
  });
  it("AC-07 the public mock API serves only GET, returns no forbidden field or cookie, and refuses writes", async () => {
    const app = express();
    app.use("/api/v1/public", mockRouter());
    app.use(notFound);
    app.use(safeErrors);
    for (const p of ["/locations", "/insights", "/locations/junction-fruit-carts/history", "/media/synthetic-media-1", "/stories"]) {
      const res = await request(app).get(`/api/v1/public${p}`);
      expect(res.status).toBe(200);
      expect(findForbiddenField(res.body), p).toBeNull();
      expect(res.headers["set-cookie"]).toBeUndefined();
      for (const m of ["post", "put", "patch", "delete"] as const) expect((await request(app)[m](`/api/v1/public${p}`).send({ interviewLatitude: 1 })).status, `${m} ${p}`).toBe(404);
    }
  });
});

describe("AC-08 restricted exports", () => {
  it("AC-08 nobody reaches the export route without an approved purpose, and only a lead grant for that study can ever hold the capability", async () => {
    for (const u of ["lead1", "adm", "res1", "leadX"]) {
      const w = await world(u);
      expect((await send(w, "post", "/exports")).status, u).toBe(403);       // route supplies no approved purpose
    }
    expect(authz.can(byAlias["lead1"]!, "export.restricted", { studyAreaId: S1 }, { purposeApproved: true }).allow).toBe(true);
    expect(authz.can(byAlias["lead1"]!, "export.restricted", { studyAreaId: S1 }).allow).toBe(false);
    for (const u of ["adm", "res1", "leadX"]) expect(authz.can(byAlias[u]!, "export.restricted", { studyAreaId: S1 }, { purposeApproved: true }).allow, u).toBe(false);
  });
});

describe("AC-09 malicious input and error responses", () => {
  it("AC-09 malformed or oversized bodies and hostile ids give the shared error shape with no stack trace, path or parser text", async () => {
    const w = await world("res1");
    const post = () => request(w.app).post("/private/interviews").set("Cookie", w.cookie).set("x-csrf-token", w.csrf).set("content-type", "application/json");
    const malformed = await post().send("{bad");
    const big = await post().send(JSON.stringify({ a: "x".repeat(300_000) }));
    const hostile = await request(w.app).get("/private/interviews/" + encodeURIComponent("../../etc/passwd'; DROP TABLE x;--<script>")).set("Cookie", w.cookie);
    const unknown = await request(w.app).get("/private/nope/at/all").set("Cookie", w.cookie);
    expect([malformed.status, big.status, hostile.status, unknown.status]).toEqual([400, 413, 403, 404]);
    for (const r of [malformed, big, hostile, unknown]) {
      expect(r.text, String(r.status)).not.toMatch(/node_modules|SyntaxError|PayloadTooLarge|\.ts:|C:\\|\/home\/|DROP TABLE|<script>/);
      expect(Object.keys(r.body).sort()).toEqual(["code", "fieldErrors", "message", "requestId", "retryable"]);
    }
  });
  it("AC-09 an unexpected exception in a handler returns a generic 500 without internal details", async () => {
    const app = express();
    app.get("/boom", () => { throw new Error("secret connection string postgres://u:p@h/db"); });
    app.use(notFound);
    app.use(safeErrors);
    const r = await request(app).get("/boom");
    expect(r.status).toBe(500);
    expect(r.text).not.toMatch(/postgres|secret|Error:/);
  });
});

describe("AC-11 audit trail is complete and content-free", () => {
  it("AC-11 allow and deny decisions are recorded with identifiers only; unauthenticated attempts are currently not recorded", async () => {
    const w = await world("res1");
    await send(w, "get", "/interviews/mine");
    await send(w, "get", "/interviews/foreign");
    await request(w.app).get("/private/interviews/mine");
    // FINDING: the 401 for a missing session is produced by requireSession before the permission hook runs, so unauthenticated probing
    // of private routes is NOT in the permission audit (register AC-11). Only authenticated allow/deny decisions appear.
    expect(w.audit.events.map((e) => `${e.outcome}:${e.reasonCode}`)).toEqual(["allow:ok", "deny:forbidden"]);
    expect(JSON.stringify(w.audit.events)).not.toMatch(/synthetic|mk_session|csrf|cookie|token/i);
  });
});

describe("AC-16 caching", () => {
  it("AC-16 the application shell marks responses no-store; private routers must be mounted behind it", async () => {
    expect((await request(createApp()).get("/health")).headers["cache-control"]).toBe("no-store");
  });
});

describe("register", () => {
  const reg = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/architecture/threat-model.json", import.meta.url)), "utf8")) as { matrixApproved: boolean; cases: { id: string; status: string; residualRisk: string; testFile?: string }[] };
  const src = readFileSync(fileURLToPath(new URL("./threat-model.test.ts", import.meta.url)), "utf8");
  it("every automated case has at least one test, every other case is marked as needing a live service or as a gap, and each states a residual risk", () => {
    for (const c of reg.cases) {
      if (c.status === "automated") {
        const text = c.testFile ? readFileSync(fileURLToPath(new URL(`../../../${c.testFile}`, import.meta.url)), "utf8") : src;
        expect(text, c.id).toContain(`"${c.id} `);
      }
      else expect(["requires-live-service", "gap"], c.id).toContain(c.status);
      expect(c.residualRisk.length, `${c.id} needs a residual-risk statement`).toBeGreaterThan(20);
    }
  });
  it("every test id used above is registered", () => {
    const used = new Set([...src.matchAll(/it\("(AC-\d\d)\b/g)].map((m) => m[1]!));
    expect(used.size).toBeGreaterThan(8);
    for (const id of used) expect(reg.cases.map((c) => c.id), id).toContain(id);
  });
  it("the register does not claim the capability matrix is approved while it is not", () => {
    expect(reg.matrixApproved).toBe(authz.approved);
  });
});
