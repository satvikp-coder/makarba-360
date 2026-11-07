import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemoryAuditSink, type AuditSink } from "@makarba/audit";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { requirePermission } from "./permission.js";

const authz = new Authorizer(loadMatrix());
const S1 = "00000000-0000-4000-8000-0000000000a1";
const R1 = "00000000-0000-4000-8000-0000000000b1";
const R2 = "00000000-0000-4000-8000-0000000000b2";
const principals = {
  loadPrincipal: async (id: string): Promise<Principal | null> =>
    id === R1 ? { userId: R1, active: true, grants: [{ role: "researcher", studyAreaId: S1, expiresAt: null }] } : null,
};

function build(sink: AuditSink, user: string | undefined, onError?: (e: unknown) => void) {
  const app = express();
  app.use((req, _res, next) => { if (user) req.session = { userId: user, mfa: true, csrfHash: "x" }; next(); });
  app.get("/rec/:id", requirePermission(authz, principals, "interview.view_private",
    (req) => ({ studyAreaId: S1, ownerId: req.params.id === "mine" ? R1 : R2 }), () => ({}), { sink, onError }),
  (_req, res) => res.json({ secret: "synthetic answers 10.5,10.5" }));
  return app;
}

describe("permission decisions are audited without content", () => {
  it("records allow and deny with identifiers and codes only", async () => {
    const sink = new MemoryAuditSink();
    const app = build(sink, R1);
    expect((await request(app).get("/rec/mine").set("x-request-id", "req-abcdef12")).status).toBe(200);
    expect((await request(app).get("/rec/theirs")).status).toBe(403);
    expect(sink.events).toEqual([
      { actorId: R1, action: "interview.view_private", outcome: "allow", reasonCode: "ok", studyAreaId: S1, requestId: "req-abcdef12" },
      { actorId: R1, action: "interview.view_private", outcome: "deny", reasonCode: "forbidden", studyAreaId: S1, requestId: undefined },
    ]);
    const dump = JSON.stringify(sink.events);
    expect(dump).not.toMatch(/synthetic answers|10\.5|cookie|token/i);
  });

  it("audits unauthenticated attempts", async () => {
    const sink = new MemoryAuditSink();
    expect((await request(build(sink, undefined)).get("/rec/mine")).status).toBe(401);
    expect(sink.events[0]).toMatchObject({ actorId: null, outcome: "deny", reasonCode: "unauthenticated" });
  });

  it("fails closed when an allowed decision cannot be audited, but keeps denials denied", async () => {
    const broken: AuditSink = { record: async () => { throw new Error("db down"); } };
    const errors: unknown[] = [];
    const app = build(broken, R1, (e) => errors.push(e));
    const allowed = await request(app).get("/rec/mine");
    expect(allowed.status).toBe(503);
    expect(JSON.stringify(allowed.body)).not.toContain("synthetic answers");
    expect((await request(app).get("/rec/theirs")).status).toBe(403);
    expect(errors).toHaveLength(2);
  });
});
