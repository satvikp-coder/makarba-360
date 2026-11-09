import { describe, expect, it } from "vitest";
import { Authorizer, assertPolicyUsable, loadMatrix, type Grant, type Principal, type Role } from "./index.js";

const matrix = loadMatrix();
const authz = new Authorizer(matrix);
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";
const ME = "user-me";
const OTHER = "user-other";
const ROLES = matrix.roles.filter((r) => r !== "visitor");

const principal = (role: Role, study: string | null = role === "administrator" ? null : S1, over: Partial<Grant> = {}): Principal => ({
  userId: ME, active: true, trained: true, grants: [{ role, studyAreaId: study, expiresAt: null, ...over }],
});
/** A resource this principal legitimately owns/uses in study S1. */
const mine = { studyAreaId: S1, ownerId: ME, authorId: OTHER };
const ctx = { purposeApproved: true, breakGlass: { reason: "synthetic emergency review", expiresAt: new Date(Date.now() + 3_600_000) } };

describe("capability matrix drives decisions (exhaustive)", () => {
  for (const a of matrix.actions.filter((x) => x.scope !== "public")) {
    for (const role of ROLES) {
      const access = a.grants[role];
      if (!access) {
        it(`${a.id}: ${role} is denied (not in matrix)`, () => {
          expect(authz.can(principal(role), a.id, mine, ctx).allow).toBe(false);
        });
        continue;
      }
      it(`${a.id}: ${role} (${access}) is allowed with a matching grant`, () => {
        expect(authz.can(principal(role), a.id, mine, ctx)).toEqual({ allow: true });
      });
      if (access !== "read" && a.scope !== "system" && role !== "administrator") {
        it(`${a.id}: ${role} is denied for a different study`, () => {
          expect(authz.can(principal(role), a.id, { ...mine, studyAreaId: S2 }, ctx).allow).toBe(false);
        });
      }
      it(`${a.id}: ${role} is denied when the grant expired or the user is inactive`, () => {
        expect(authz.can(principal(role, undefined, { expiresAt: new Date(Date.now() - 1000) }), a.id, mine, ctx).allow).toBe(false);
        expect(authz.can({ ...principal(role), active: false }, a.id, mine, ctx).allow).toBe(false);
      });
      if (access === "own" && a.scope === "record") {
        it(`${a.id}: ${role} is denied on another user's record`, () => {
          expect(authz.can(principal(role), a.id, { ...mine, ownerId: OTHER }, ctx).allow).toBe(false);
        });
      }
    }
    it(`${a.id}: anonymous and role-less users are denied`, () => {
      expect(authz.can(null, a.id, mine, ctx).allow).toBe(false);
      expect(authz.can({ userId: ME, active: true, grants: [] }, a.id, mine, ctx).allow).toBe(false);
    });
  }
  it("public content is readable by anyone", () => {
    expect(authz.can(null, "public.read_published")).toEqual({ allow: true });
  });
});

describe("required negative cases", () => {
  it("a researcher cannot read another study's records", () => {
    const r = authz.can(principal("researcher"), "interview.view_private", { studyAreaId: S2, ownerId: ME });
    expect(r.allow).toBe(false);
  });
  it("a researcher cannot read a colleague's record in their own study", () => {
    expect(authz.can(principal("researcher"), "interview.view_private", { studyAreaId: S1, ownerId: OTHER }).allow).toBe(false);
  });
  it("a researcher cannot grant the administrator role (or any role)", () => {
    const researcher = principal("researcher");
    expect(authz.canAssignRole(researcher, { targetUserId: OTHER, role: "administrator", studyAreaId: null }).allow).toBe(false);
    expect(authz.canAssignRole(researcher, { targetUserId: OTHER, role: "lead", studyAreaId: S1 }).allow).toBe(false);
  });
  it("an administrator alone cannot view raw interviews, GPS or consent", () => {
    const admin = principal("administrator");
    for (const id of ["interview.view_private", "gps.capture", "consent.verify", "interview.edit_draft"]) {
      expect(authz.can(admin, id, mine, ctx).allow, id).toBe(false);
    }
  });
  it("an administrator may manage users but not themselves, and only with valid scope", () => {
    const admin = principal("administrator");
    expect(authz.canAssignRole(admin, { targetUserId: OTHER, role: "researcher", studyAreaId: S1 })).toEqual({ allow: true });
    expect(authz.canAssignRole(admin, { targetUserId: ME, role: "lead", studyAreaId: S1 }).allow).toBe(false);
    expect(authz.canAssignRole(admin, { targetUserId: OTHER, role: "researcher", studyAreaId: null }).allow).toBe(false);
    expect(authz.canAssignRole(admin, { targetUserId: OTHER, role: "administrator", studyAreaId: S1 }).allow).toBe(false);
    expect(authz.canAssignRole(admin, { targetUserId: OTHER, role: "visitor", studyAreaId: null }).allow).toBe(false);
  });
  it("nobody publishes their own work", () => {
    const lead = principal("lead");
    expect(authz.can(lead, "content.publish", { studyAreaId: S1, authorId: ME }).allow).toBe(false);
    expect(authz.can(lead, "content.publish", { studyAreaId: S1, authorId: OTHER })).toEqual({ allow: true });
    expect(authz.can(lead, "content.publish", { studyAreaId: S1 }).allow).toBe(false);
  });
  it("restricted export needs an approved purpose", () => {
    expect(authz.can(principal("lead"), "export.restricted", { studyAreaId: S1 }, {}).allow).toBe(false);
    expect(authz.can(principal("lead"), "export.restricted", { studyAreaId: S1 }, { purposeApproved: true }).allow).toBe(true);
  });
  it("break-glass needs a reason and a short expiry", () => {
    const p = principal("administrator");
    const soon = new Date(Date.now() + 1000);
    expect(authz.can(p, "breakglass.access", mine, { breakGlass: { reason: "", expiresAt: soon } }).allow).toBe(false);
    expect(authz.can(p, "breakglass.access", mine, {}).allow).toBe(false);
    expect(authz.can(p, "breakglass.access", mine, { breakGlass: { reason: "valid long reason", expiresAt: new Date(Date.now() + 48 * 3_600_000) } }).allow).toBe(false);
  });
  it("denies unknown actions and evaluates multiple grants correctly", () => {
    expect(authz.can(principal("administrator"), "does.not.exist").allow).toBe(false);
    const both: Principal = { userId: ME, active: true, trained: true, grants: [
      { role: "researcher", studyAreaId: S2, expiresAt: null }, { role: "researcher", studyAreaId: S1, expiresAt: null }] };
    expect(authz.can(both, "visit.start", { studyAreaId: S1, ownerId: ME }).allow).toBe(true);
    expect(authz.can(both, "visit.start", { studyAreaId: "00000000-0000-4000-8000-0000000000a3", ownerId: ME }).allow).toBe(false);
  });
});

describe("training prerequisite (issue #33)", () => {
  it("an untrained researcher cannot perform any collection action, but can still read what the matrix allows", () => {
    const untrained = { ...principal("researcher"), trained: false };
    for (const id of ["visit.start", "interview.create", "gps.capture", "subject_location.link", "media.submit"]) {
      expect(authz.can(untrained, id, mine).allow, id).toBe(false);
      expect(authz.can(principal("researcher"), id, mine).allow, id).toBe(true);
    }
    expect(authz.can(untrained, "interview.request_correction", mine).allow).toBe(true);
  });
});

describe("production guard", () => {
  it("refuses production while the matrix is only PROPOSED, allows local and staging", () => {
    const unapproved = new Authorizer({ ...matrix, status: "PROPOSED — AWAITING STAKEHOLDER APPROVAL", approved_by: null, approved_on: null });
    expect(unapproved.approved).toBe(false);
    expect(() => assertPolicyUsable(unapproved, "production")).toThrow(/not approved/);
    expect(() => assertPolicyUsable(unapproved, "staging")).not.toThrow();
    expect(() => assertPolicyUsable(unapproved, "local")).not.toThrow();
  });
  it("accepts production once genuinely approved", () => {
    const approved = new Authorizer({ ...matrix, status: "APPROVED", approved_by: "synthetic-test-approver", approved_on: "2000-01-01" });
    expect(approved.approved).toBe(true);
    expect(() => assertPolicyUsable(approved, "production")).not.toThrow();
  });
});
