import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { requirePermission } from "./permission.js";

const authz = new Authorizer(loadMatrix());
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";

const people: Record<string, Principal> = {
  researcher: { userId: "r1", active: true, grants: [{ role: "researcher", studyAreaId: S1, expiresAt: null }] },
  admin: { userId: "a1", active: true, grants: [{ role: "administrator", studyAreaId: null, expiresAt: null }] },
};
const records: Record<string, { studyAreaId: string; ownerId: string }> = {
  "rec-mine": { studyAreaId: S1, ownerId: "r1" },
  "rec-colleague": { studyAreaId: S1, ownerId: "r2" },
  "rec-other-study": { studyAreaId: S2, ownerId: "r1" },
};

function build(sessionUser: string | undefined) {
  const app = express();
  app.use((req, _res, next) => {
    if (sessionUser) req.session = { userId: sessionUser, mfa: true, csrfHash: "x" };
    next();
  });
  const principals = { loadPrincipal: async (id: string) => Object.values(people).find((p) => p.userId === id) ?? null };
  // Ownership comes from server data keyed by the URL id, never from a client claim.
  app.get(
    "/private/interviews/:id",
    requirePermission(authz, principals, "interview.view_private", (req) => records[String(req.params.id)] ?? {}),
    (req, res) => res.json({ id: req.params.id, synthetic: true }),
  );
  app.get("/admin/users", requirePermission(authz, principals, "user.manage"), (_req, res) => res.json({ ok: true }));
  return app;
}

describe("requirePermission", () => {
  it("answers 401 without a session", async () => {
    expect((await request(build(undefined)).get("/private/interviews/rec-mine")).status).toBe(401);
  });
  it("allows a researcher on their own record only", async () => {
    const app = build("r1");
    expect((await request(app).get("/private/interviews/rec-mine")).status).toBe(200);
    expect((await request(app).get("/private/interviews/rec-colleague")).status).toBe(403);
    expect((await request(app).get("/private/interviews/rec-other-study")).status).toBe(403);
    expect((await request(app).get("/private/interviews/does-not-exist")).status).toBe(403);
  });
  it("does not let the administrator read raw interviews, but allows user management", async () => {
    const app = build("a1");
    expect((await request(app).get("/private/interviews/rec-mine")).status).toBe(403);
    expect((await request(app).get("/admin/users")).status).toBe(200);
  });
  it("denies a researcher the admin route and never explains why", async () => {
    const r = await request(build("r1")).get("/admin/users");
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toMatch(/study|grant|owner|role/i);
  });
  it("denies unknown users", async () => {
    expect((await request(build("ghost")).get("/admin/users")).status).toBe(403);
  });
});
