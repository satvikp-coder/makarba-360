import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemorySessionStore, SessionService } from "@makarba/auth";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { privateApi, validateRoutes, type PrivateRoute } from "./private-routes.js";

const authz = new Authorizer(loadMatrix());
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";

const people: Record<string, Principal> = {
  r1: { userId: "r1", active: true, grants: [{ role: "researcher", studyAreaId: S1, expiresAt: null }] },
  adm: { userId: "adm", active: true, grants: [{ role: "administrator", studyAreaId: null, expiresAt: null }] },
};
const records: Record<string, { studyAreaId: string; ownerId: string }> = { mine: { studyAreaId: S1, ownerId: "r1" }, other: { studyAreaId: S2, ownerId: "r1" } };

const routes: PrivateRoute[] = [
  { method: "get", path: "/interviews/:id", action: "interview.view_private", resolve: (req) => records[String(req.params.id)] ?? {}, handler: (req, res) => res.json({ id: req.params.id }) },
  { method: "post", path: "/interviews/:id/correction", action: "interview.request_correction", resolve: (req) => records[String(req.params.id)] ?? {}, handler: (_req, res) => res.json({ ok: true }) },
  { method: "get", path: "/users", action: "user.manage", handler: (_req, res) => res.json({ users: [] }) },
];

async function build(user: string) {
  const sessions = new SessionService({ store: new MemorySessionStore() });
  const { token, csrfToken } = await sessions.create(user, true);
  const principals = { loadPrincipal: async (id: string) => people[id] ?? null };
  const app = express();
  app.use(express.json());
  app.use("/private", privateApi({ authz, principals, sessions, routes }));
  return { app, cookie: `mk_session=${token}`, csrf: csrfToken };
}

describe("private API construction", () => {
  it("rejects unknown capabilities, public capabilities and duplicates at start-up", () => {
    expect(validateRoutes(authz, [{ ...routes[0]!, action: "interview.view_privte" }])).toEqual([expect.stringContaining("unknown capability")]);
    expect(validateRoutes(authz, [{ ...routes[0]!, action: "public.read_published" }])[0]).toMatch(/public capability/);
    expect(validateRoutes(authz, [routes[0]!, routes[0]!])[0]).toMatch(/duplicate/);
    expect(() => privateApi({ authz, principals: { loadPrincipal: async () => null }, sessions: new SessionService({ store: new MemorySessionStore() }), routes: [{ ...routes[0]!, action: "nope" }] })).toThrow(/Invalid private routes/);
  });
  it("every shipped route names a valid capability", () => {
    expect(validateRoutes(authz, routes)).toEqual([]);
  });
});

describe("private API enforcement", () => {
  it("denies every private route without a session", async () => {
    const sessions = new SessionService({ store: new MemorySessionStore() });
    const app = express();
    app.use("/private", privateApi({ authz, principals: { loadPrincipal: async () => null }, sessions, routes }));
    for (const r of routes) expect((await request(app)[r.method]("/private" + r.path.replace(":id", "mine"))).status, r.path).toBe(401);
    expect((await request(app).get("/private/capabilities")).status).toBe(401);
  });

  it("applies role, study and ownership checks on each route", async () => {
    const { app, cookie, csrf } = await build("r1");
    expect((await request(app).get("/private/interviews/mine").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/private/interviews/other").set("Cookie", cookie)).status).toBe(403);
    expect((await request(app).get("/private/users").set("Cookie", cookie)).status).toBe(403);
    expect((await request(app).post("/private/interviews/mine/correction").set("Cookie", cookie).set("x-csrf-token", csrf)).status).toBe(200);
  });

  it("requires a CSRF token on writes", async () => {
    const { app, cookie } = await build("r1");
    expect((await request(app).post("/private/interviews/mine/correction").set("Cookie", cookie)).status).toBe(403);
  });

  it("administrator manages users but cannot read raw interviews", async () => {
    const { app, cookie } = await build("adm");
    expect((await request(app).get("/private/users").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/private/interviews/mine").set("Cookie", cookie)).status).toBe(403);
  });
});

describe("UI and API agree; a hidden button is never the control", () => {
  it("capabilities list matches what the server actually allows", async () => {
    const { app, cookie, csrf } = await build("r1");
    const caps = (await request(app).get(`/private/capabilities?studyAreaId=${S1}`).set("Cookie", cookie)).body;
    expect(caps.advisory).toBe(true);
    expect(caps.allowed).toContain("interview.request_correction");
    expect(caps.allowed).not.toContain("user.manage");
    expect(caps.allowed).not.toContain("content.publish");
    // Each route's real outcome equals the advertised capability.
    const view = await request(app).get("/private/interviews/mine").set("Cookie", cookie);
    expect(view.status === 200).toBe(caps.allowed.includes("interview.view_private"));
    const users = await request(app).get("/private/users").set("Cookie", cookie);
    expect(users.status === 200).toBe(caps.allowed.includes("user.manage"));
    void csrf;
  });
  it("calling a route directly is denied even if the UI would have hidden the control", async () => {
    const { app, cookie } = await build("r1");
    const caps = (await request(app).get(`/private/capabilities?studyAreaId=${S1}`).set("Cookie", cookie)).body;
    expect(caps.allowed).not.toContain("user.manage"); // UI hides the button
    expect((await request(app).get("/private/users").set("Cookie", cookie)).status).toBe(403); // server still denies
  });
  it("capabilities for an unscoped request exclude study-scoped actions", async () => {
    const { app, cookie } = await build("r1");
    const caps = (await request(app).get("/private/capabilities").set("Cookie", cookie)).body;
    expect(caps.allowed).not.toContain("interview.create");
  });
});
