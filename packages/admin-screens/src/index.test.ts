import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { describe, expect, it } from "vitest";
import { bulkApprovePreview, canOpen, MAX_BATCH, navigationFor, requireReason, SCREENS, type BulkItem } from "./index.js";

// Uses the real authorizer and the real (proposed) capability matrix, with synthetic people and study ids.
const az = new Authorizer(loadMatrix());
const S1 = { studyAreaId: "study-1" }, S2 = { studyAreaId: "study-2" };
const person = (userId: string, role: Principal["grants"][number]["role"], studyAreaId: string | null, extra: Partial<Principal> = {}): Principal =>
  ({ userId, active: true, trained: true, grants: [{ role, studyAreaId, expiresAt: null }], ...extra });
const admin = person("adm", "administrator", null);            // unscoped technical administrator
const lead = person("lead", "lead", "study-1");
const reviewer = person("rev", "reviewer", "study-1");
const researcher = person("res", "researcher", "study-1");
const ids = (p: Principal | null, res = S1) => navigationFor(az, p, res).map((n) => n.id);

describe("screen catalogue", () => {
  it("covers A01 to A12 exactly once, and raw-data screens are marked", () => {
    expect(SCREENS.map((s) => s.id)).toEqual(Array.from({ length: 12 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`));
    expect(SCREENS.filter((s) => s.rawData).map((s) => s.id)).toEqual(["A04", "A05"]);
  });
  it("every action a screen depends on exists in the capability matrix (catches typos and matrix changes)", () => {
    const known = new Set(az.matrix.actions.map((a) => a.id));
    for (const s of SCREENS) for (const a of s.anyOf) expect(known.has(a), `${s.id} uses unknown action ${a}`).toBe(true);
  });
});

describe("unscoped administrator cannot open raw data review", () => {
  it("is refused A04 and A05 for any study, with a reason, and cannot see them in navigation", () => {
    for (const study of [S1, S2]) for (const id of ["A04", "A05"]) {
      const d = canOpen(az, admin, id, study);
      expect(d.allow, `${id} ${study.studyAreaId}`).toBe(false);
    }
    expect(ids(admin)).not.toContain("A04");
    expect(ids(admin)).not.toContain("A05");
  });
  it("can still administer: accounts, audit, questionnaires, operations, overview counts, and export JOBS (not data)", () => {
    expect(ids(admin)).toEqual(expect.arrayContaining(["A01", "A02", "A09", "A10", "A11", "A12"]));
    const a09 = canOpen(az, admin, "A09", S1);
    expect(a09).toEqual({ allow: true, mode: "operational-only" });
  });
  it("cannot open publication review or location review either", () => {
    for (const id of ["A06", "A07", "A08"]) expect(canOpen(az, admin, id, S1).allow).toBe(false);
  });
});

describe("other roles see only their own screens", () => {
  it("lead sees review screens for their study, full exports; not accounts or questionnaire admin", () => {
    const n = ids(lead);
    expect(n).toEqual(expect.arrayContaining(["A04", "A05", "A06", "A07", "A08", "A09", "A10"]));
    expect(n).not.toContain("A02");
    expect(n).not.toContain("A11");
    expect(canOpen(az, lead, "A09", S1)).toEqual({ allow: true, mode: "full" });
    // creating a restricted export still needs an approved purpose (enforced by the authorizer at job creation)
    expect(az.can(lead, "export.restricted", S1)).toEqual({ allow: false, reason: "approved purpose required" });
  });
  it("a lead's access is limited to their own study", () => {
    expect(canOpen(az, lead, "A05", S1).allow).toBe(true);
    expect(canOpen(az, lead, "A05", S2).allow).toBe(false);
    expect(ids(lead, S2)).not.toContain("A05");
  });
  it("reviewer cannot manage accounts, audit or exports; researcher sees no management screens at all", () => {
    expect(ids(reviewer)).not.toEqual(expect.arrayContaining(["A02", "A10", "A09"]));
    expect(ids(researcher).filter((i) => i !== "A01" && i !== "A03")).toEqual([]);
  });
  it("anonymous, inactive and expired people see nothing", () => {
    expect(ids(null)).toEqual([]);
    expect(ids({ ...lead, active: false })).toEqual([]);
    const expired: Principal = { ...lead, grants: [{ role: "lead", studyAreaId: "study-1", expiresAt: new Date("2020-01-01") }] };
    expect(ids(expired)).toEqual([]);
  });
  it("unknown screens are refused", () => { expect(canOpen(az, lead, "A99", S1)).toEqual({ allow: false, reason: "unknown screen" }); });
});

describe("bulk approval preview", () => {
  const item = (id: string, o: Partial<BulkItem> = {}): BulkItem => ({ id, consentVerified: true, evidenceComplete: true, revision: 2, reviewedRevision: 2, authorId: "someone-else", ...o });
  it("lists eligible records and excludes each failure with its own reason", () => {
    const p = bulkApprovePreview(az, lead, S1, [
      item("ok"), item("noconsent", { consentVerified: false }), item("noevidence", { evidenceComplete: false }),
      item("stale", { revision: 3 }), item("mine", { authorId: "lead" }), item("ok"),
    ]);
    expect(p.eligible).toEqual(["ok"]);
    expect(Object.fromEntries(p.excluded.map((e) => [e.id, e.reason]))).toMatchObject({
      noconsent: "consent not verified", noevidence: "evidence incomplete", stale: "changed since it was reviewed",
      mine: "independent reviewer required (no self-approval)",
    });
    expect(p.excluded.some((e) => e.reason === "duplicate selection")).toBe(true);
    expect(p.selected).toBe(6);
    expect(p.mayProceed).toBe(true);
  });
  it("nothing eligible means the confirm step is not offered", () => {
    expect(bulkApprovePreview(az, lead, S1, [item("a", { consentVerified: false })]).mayProceed).toBe(false);
    expect(bulkApprovePreview(az, lead, S1, []).mayProceed).toBe(false);
  });
  it("an oversized batch cannot proceed", () => {
    const many = Array.from({ length: MAX_BATCH + 1 }, (_, i) => item(`r${i}`));
    expect(bulkApprovePreview(az, lead, S1, many).mayProceed).toBe(false);
    expect(bulkApprovePreview(az, lead, S1, many.slice(0, MAX_BATCH)).mayProceed).toBe(true);
  });
  it("people without publication rights get no eligible records, even for good ones; other studies are refused", () => {
    expect(bulkApprovePreview(az, admin, S1, [item("ok")])).toMatchObject({ eligible: [], mayProceed: false });
    expect(bulkApprovePreview(az, researcher, S1, [item("ok")]).eligible).toEqual([]);
    expect(bulkApprovePreview(az, lead, S2, [item("ok")]).eligible).toEqual([]);
  });
});

describe("reasons for sensitive actions", () => {
  it("rejects blank and too-short reasons, trims valid ones", () => {
    for (const r of ["", "   ", "abcd"]) expect(requireReason(r).ok).toBe(false);
    expect(requireReason("  Consent withdrawn  ")).toEqual({ ok: true, reason: "Consent withdrawn" });
  });
});
