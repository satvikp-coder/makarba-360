import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { describe, expect, it } from "vitest";
import { bulkApprovePreview, canOpen, dashboardFor, MAX_BATCH, navigationFor, requireReason, SCREENS, type BulkItem } from "./index.js";

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

describe("role-limited dashboard (#94)", () => {
  const q = (id: string, studyAreaId: string, type: "consent" | "gps" | "location" | "history" | "media" | "export", ageDays = 1) => ({ id, studyAreaId, type, ageDays });
  const queue = [q("q1", "study-1", "consent", 3), q("q2", "study-1", "gps", 9), q("q3", "study-1", "location"), q("q4", "study-2", "consent", 20), q("q5", "study-2", "gps"), q("q6", "study-1", "history", 2)];
  const studies = ["study-1", "study-2"];
  it("a lead sees counts and records only for the assigned study", () => {
    const d = dashboardFor(az, lead, studies, queue);
    expect(d.totals).toEqual({ consent: 1, gps: 1, location: 1, history: 1 });
    expect(d.records.map((r) => r.id).sort()).toEqual(["q1", "q2", "q3", "q6"]);
    expect(d.records.every((r) => r.studyAreaId === "study-1")).toBe(true);
    expect(d.oldestDays).toBe(9);
  });
  it("a technical administrator sees counts across studies but never a record, and is told why", () => {
    const d = dashboardFor(az, admin, studies, queue);
    expect(d.totals).toEqual({ consent: 2, gps: 2, location: 1, history: 1 });
    expect(d.records).toEqual([]);
    expect(d.notes).toContain("You can see how many items are waiting, but not the records themselves.");
    expect(JSON.stringify(d)).not.toMatch(/"id":"q\d"/);
  });
  it("navigation follows the same rules as the screens: admin has accounts and operations, lead has review screens", () => {
    expect(dashboardFor(az, admin, studies, queue).navigation.map((n) => n.id)).toEqual(expect.arrayContaining(["A02", "A10", "A11", "A12"]));
    expect(dashboardFor(az, admin, studies, queue).navigation.map((n) => n.id)).not.toContain("A05");
    expect(dashboardFor(az, lead, studies, queue).navigation.map((n) => n.id)).toEqual(expect.arrayContaining(["A04", "A05", "A06", "A07"]));
  });
  it("a researcher, an anonymous visitor and inactive or expired grants see nothing", () => {
    for (const p of [researcher, null, { ...lead, active: false }, { ...lead, grants: [{ role: "lead" as const, studyAreaId: "study-1", expiresAt: new Date("2020-01-01") }] }]) {
      const d = dashboardFor(az, p, studies, queue);
      expect(d.totals).toEqual({});
      expect(d.records).toEqual([]);
      expect(d.oldestDays).toBeNull();
      expect(d.notes).toContain("No queue totals are available for your role.");
    }
  });
  it("items for a study that was not requested are ignored rather than counted", () => {
    expect(dashboardFor(az, lead, ["study-1"], queue).totals.consent).toBe(1);
    expect(dashboardFor(az, lead, [], queue).totals).toEqual({});
  });
  it("a lead for study-2 only does not see study-1 items", () => {
    const d = dashboardFor(az, person("lead-x", "lead", "study-2"), studies, queue);
    expect(d.records.map((r) => r.id).sort()).toEqual(["q4", "q5"]);
    expect(d.totals).toEqual({ consent: 1, gps: 1 });
  });
});
