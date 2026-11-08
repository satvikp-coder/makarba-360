import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { describe, expect, it } from "vitest";
import { approveExport, download, MAX_DOWNLOADS, requestExport, revokeExport, runExport, type AggregateRow, type Job } from "./index.js";

// Synthetic people, study and aggregate rows only; real authorizer and (proposed) capability matrix.
const az = new Authorizer(loadMatrix());
const S1 = { studyAreaId: "study-1" };
const person = (userId: string, role: Principal["grants"][number]["role"], studyAreaId: string | null): Principal => ({ userId, active: true, trained: true, grants: [{ role, studyAreaId, expiresAt: null }] });
const lead1 = person("lead1", "lead", "study-1"), lead2 = person("lead2", "lead", "study-1"), leadOther = person("lead-x", "lead", "study-2");
const admin = person("adm", "administrator", null), researcher = person("res", "researcher", "study-1");
const T0 = new Date("2026-03-01T10:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const req = { id: "job1", purpose: "Community report for the ward meeting", format: "csv" as const, fields: ["group", "period", "n", "valid_n"] };
const rows: AggregateRow[] = [
  { group: "resident", period: "2026-02", n: 30, valid_n: 28 }, { group: "worker", period: "2026-02", n: 12, valid_n: 10 }, { group: "official", period: "2026-02", n: 2, valid_n: 2 },
];
const ok = <T,>(r: { ok: true } & T | { ok: false; reasons: string[] }): T => { if (!r.ok) throw new Error(r.reasons.join("; ")); return r; };
const approved = (r = req): Job => ok(approveExport(az, ok(requestExport(az, lead1, S1, r, T0)).job, lead2, T0)).job;
const ready = (data = rows, r = req) => ok(runExport(approved(r), data, T0, () => "tok-1"));

describe("request: purpose and field limits", () => {
  it("a lead can request approved aggregate fields", () => { expect(ok(requestExport(az, lead1, S1, req, T0)).job.state).toBe("requested"); });
  it("raw identifiers, exact GPS and unknown fields are rejected", () => {
    for (const f of ["interviewLatitude", "gpsAccuracyM", "researcherId", "answers", "participantName", "phone", "anything_else"]) {
      const r = requestExport(az, lead1, S1, { ...req, fields: ["group", f] }, T0);
      expect(r.ok, f).toBe(false);
    }
  });
  it("a vague purpose and an empty field list are rejected", () => {
    expect(requestExport(az, lead1, S1, { ...req, purpose: "report" }, T0).ok).toBe(false);
    expect(requestExport(az, lead1, S1, { ...req, fields: [] }, T0).ok).toBe(false);
  });
  it("people without the export grant cannot even request: researcher, technical admin, lead of another study", () => {
    for (const p of [researcher, admin, leadOther, { ...lead1, active: false }]) expect(requestExport(az, p, S1, req, T0).ok).toBe(false);
  });
});

describe("approval needs a second person with the grant", () => {
  it("the requester cannot approve their own export", () => {
    const j = ok(requestExport(az, lead1, S1, req, T0)).job;
    expect(approveExport(az, j, lead1, T0)).toEqual({ ok: false, reasons: ["the requester cannot approve their own export"] });
  });
  it("an approver without the grant for that study is refused; an already-approved job cannot be approved again", () => {
    const j = ok(requestExport(az, lead1, S1, req, T0)).job;
    expect(approveExport(az, j, leadOther, T0).ok).toBe(false);
    expect(approveExport(az, j, admin, T0).ok).toBe(false);
    expect(approveExport(az, approved(), lead2, T0).ok).toBe(false);
  });
});

describe("run: anonymised file", () => {
  it("cannot run before approval", () => {
    const j = ok(requestExport(az, lead1, S1, req, T0)).job;
    expect(runExport(j, rows, T0, () => "t").ok).toBe(false);
  });
  it("rows under k are removed and counted; a single hidden row also hides the smallest shown one (no subtraction)", () => {
    const r = ready();
    expect(r.job.file).toMatchObject({ rows: 1, suppressedRows: 2 });
    expect(r.job.file!.body).toBe("group,period,n,valid_n\r\nresident,2026-02,30,28\r\n");
    expect(r.job.file!.body).not.toContain("official");
  });
  it("with two small rows hidden no extra row is hidden", () => {
    const data: AggregateRow[] = [...rows, { group: "visitor", period: "2026-02", n: 3, valid_n: 3 }];
    expect(ready(data).job.file).toMatchObject({ rows: 2, suppressedRows: 2 });
  });
  it("a row is low-n if either n or valid_n is under k", () => {
    expect(ready([...rows, { group: "shop", period: "2026-02", n: 40, valid_n: 4 }, { group: "x", period: "2026-02", n: 30, valid_n: 28 }]).job.file!.body).not.toContain("shop");
  });
  it("fails closed when nothing safe remains, and on inconsistent input", () => {
    const j = approved();
    expect(runExport(j, [{ group: "a", period: "p", n: 2, valid_n: 2 }], T0, () => "t")).toMatchObject({ ok: false });
    expect(runExport(j, [{ group: "a", period: "p", n: 10, valid_n: 11 }], T0, () => "t")).toMatchObject({ ok: false });
    expect(runExport(j, [{ group: "a", period: "p", n: -1, valid_n: 0 }], T0, () => "t").ok).toBe(false);
  });
  it("only the requested fields appear, in CSV and GeoJSON-style JSON", () => {
    const r = ready(rows, { ...req, format: "csv", fields: ["group", "n"] });
    expect(r.job.file!.body).toBe("group,n\r\nresident,30\r\n");
    const j = ready(rows, { ...req, format: "geojson", fields: ["group", "n"] });
    expect(JSON.parse(j.job.file!.body)).toEqual({ type: "AggregateTable", rows: [{ group: "resident", n: 30 }] });
  });
  it("spreadsheet formulas in group names are neutralised", () => {
    const data: AggregateRow[] = [{ group: "=HYPERLINK(\"http://evil\")", period: "2026-02", n: 30, valid_n: 28 }, { group: "+cmd|' /C calc'!A0", period: "2026-02", n: 20, valid_n: 20 }, { group: "ok", period: "2026-02", n: 12, valid_n: 10 }];
    const body = ready(data).job.file!.body;
    const lines = body.split("\r\n").slice(1).filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith(`"'=HYPERLINK(`)).toBe(true);
    expect(lines[1]!.startsWith("'+cmd")).toBe(true);
    expect(lines[2]).toBe("ok,2026-02,12,10");
    expect(body).not.toMatch(/(^|\r\n)[=+@-]/);
  });
  it("expiry must be positive and at most 72 hours", () => {
    for (const h of [0, -1, 73, NaN]) expect(runExport(approved(), rows, T0, () => "t", h).ok).toBe(false);
    expect(runExport(approved(), rows, T0, () => "t", 72).ok).toBe(true);
  });
});

describe("download: private, expiring, audited", () => {
  const dl = (job: Job, who: Principal | null, token = "tok-1", at = T0) => download(az, job, who, token, at);
  it("the requester with the right token can download; the audit records it without the payload", () => {
    const r = ready();
    const d = dl(r.job, lead1);
    expect(d.result).toMatchObject({ ok: true });
    expect(d.job.downloads).toBe(1);
    const last = d.job.audit[d.job.audit.length - 1]!;
    expect(last).toMatchObject({ actor: "lead1", action: "download", outcome: "ok" });
    expect(JSON.stringify(d.job.audit)).not.toContain("resident");
  });
  it("unauthorised downloads are rejected and audited: anonymous, other lead, same-study approver, technical admin, wrong token", () => {
    const r = ready();
    for (const [who, tok, why] of [[null, "tok-1", "sign-in required"], [lead2, "tok-1", "only the requester can download"], [admin, "tok-1", "only the requester can download"], [lead1, "wrong", "invalid download link"]] as const) {
      const d = dl(r.job, who, tok);
      expect(d.result).toEqual({ ok: false, reason: why });
      expect(d.job.audit[d.job.audit.length - 1]).toMatchObject({ action: "download", outcome: "denied" });
    }
  });
  it("the link expires at the boundary and not before", () => {
    const r = ready();
    expect(dl(r.job, lead1, "tok-1", hours(23.99)).result.ok).toBe(true);
    expect(dl(r.job, lead1, "tok-1", hours(24))).toMatchObject({ result: { ok: false, reason: "download link has expired" } });
  });
  it("the number of downloads is limited", () => {
    let job = ready().job;
    for (let i = 0; i < MAX_DOWNLOADS; i++) job = dl(job, lead1).job;
    expect(dl(job, lead1).result).toEqual({ ok: false, reason: "download limit reached" });
  });
  it("withdrawing the requester's access after the file was made blocks the download", () => {
    const r = ready();
    expect(dl(r.job, { ...lead1, active: false }).result.ok).toBe(false);
    expect(dl(r.job, { ...lead1, grants: [{ role: "lead", studyAreaId: "study-1", expiresAt: new Date("2026-01-01") }] }).result.ok).toBe(false);
  });
  it("a job that is not ready, or was revoked, yields nothing; revoking needs a reason and deletes the file", () => {
    expect(dl(approved(), lead1).result).toEqual({ ok: false, reason: "export is not ready" });
    expect(revokeExport(ready().job, "lead2", "  ", T0).ok).toBe(false);
    const rev = ok(revokeExport(ready().job, "lead2", "Purpose changed", T0)).job;
    expect(rev.file).toBeNull();
    expect(dl(rev, lead1).result).toEqual({ ok: false, reason: "export was revoked" });
  });
  it("the token is stored only as a hash", () => {
    const r = ready();
    expect(JSON.stringify(r.job)).not.toContain("tok-1");
    expect(r.job.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
