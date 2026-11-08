import type { Answer, Answers } from "@makarba/survey";
import type { Queryable } from "./pg-public-repository.js";

export type FieldErrorCode = "not_found" | "pending_drafts" | "conflict" | "rejected_value" | "consent_required" | "not_active" | "not_draft";
export class FieldRepoError extends Error {
  constructor(public code: FieldErrorCode, public ids: string[] = []) { super(code); }
}

export interface VisitRecord { id: string; studyAreaId: string; researcherId: string; status: "active" | "ended" | "cancelled"; startedAt: string; endedAt: string | null }
export interface InterviewRecord {
  id: string; visitId: string; studyAreaId: string; collectorId: string; surveyVersionId: string; status: "draft" | "submitted" | "abandoned" | "withdrawn";
  startedAt: string; startedOffsetMinutes: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (v: unknown) => new Date(v as string).toISOString();
const visit = (r: Record<string, unknown>): VisitRecord => ({
  id: r["id"] as string, studyAreaId: r["study_area_id"] as string, researcherId: r["researcher_id"] as string, status: r["status"] as VisitRecord["status"],
  startedAt: iso(r["started_at"]), endedAt: r["ended_at"] ? iso(r["ended_at"]) : null,
});
const interview = (r: Record<string, unknown>): InterviewRecord => ({
  id: r["id"] as string, visitId: r["visit_id"] as string, studyAreaId: r["study_area_id"] as string, collectorId: r["collector_id"] as string,
  surveyVersionId: r["survey_version_id"] as string, status: r["status"] as InterviewRecord["status"], startedAt: iso(r["started_at"]), startedOffsetMinutes: r["started_offset_minutes"] as number,
});

/** Field visits, interviews and draft answers (issues #44, #45). SQLSTATE 23001 from the schema's own guards is mapped to a refusal, never leaked. */
export class PgFieldRepository {
  constructor(private db: Queryable) {}

  private async run(sql: string, params: unknown[]) {
    try { return await this.db.query(sql, params); }
    catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "23001") {
        const m = err.message ?? "";
        if (/consent/.test(m)) throw new FieldRepoError("consent_required");
        if (/not active|frozen/.test(m)) throw new FieldRepoError("not_active");
        if (/only change while/.test(m)) throw new FieldRepoError("not_draft");
        throw new FieldRepoError("rejected_value");
      }
      if (err.code && ["23503", "23514", "22P02", "22007", "22008"].includes(err.code)) throw new FieldRepoError("rejected_value");
      throw e;
    }
  }

  async startVisit(researcherId: string, studyAreaId: string): Promise<VisitRecord> {
    const r = await this.run("INSERT INTO private.field_visits (study_area_id, researcher_id) VALUES ($1, $2) RETURNING *", [studyAreaId, researcherId]);
    return visit(r.rows[0]!);
  }

  async getVisit(id: string): Promise<(VisitRecord & { history: { status: string; at: string }[]; openDrafts: string[] }) | null> {
    if (!UUID.test(id)) return null;
    const v = await this.db.query("SELECT * FROM private.field_visits WHERE id = $1", [id]);
    if (!v.rows[0]) return null;
    const h = await this.db.query("SELECT status, at FROM audit.field_visit_status_history WHERE visit_id = $1 ORDER BY id", [id]);
    const d = await this.db.query("SELECT id FROM private.interviews WHERE visit_id = $1 AND status = 'draft' ORDER BY created_at, id", [id]);
    return { ...visit(v.rows[0]), history: h.rows.map((x) => ({ status: x["status"] as string, at: iso(x["at"]) })), openDrafts: d.rows.map((x) => x["id"] as string) };
  }

  /**
   * Ending a visit with open drafts needs a decision for EACH draft: keep it for later sync, or mark it abandoned (never deleted).
   * The final UPDATE is the authority: it only succeeds if every draft still open is one the caller chose to keep.
   */
  async endVisit(id: string, reconcile: Record<string, "keep" | "abandon">): Promise<VisitRecord> {
    const cur = await this.getVisit(id);
    if (!cur) throw new FieldRepoError("not_found");
    if (cur.status !== "active") throw new FieldRepoError("not_active");
    const unresolved = cur.openDrafts.filter((d) => reconcile[d] !== "keep" && reconcile[d] !== "abandon");
    if (unresolved.length) throw new FieldRepoError("pending_drafts", unresolved);
    const abandon = cur.openDrafts.filter((d) => reconcile[d] === "abandon");
    const keep = cur.openDrafts.filter((d) => reconcile[d] === "keep");
    if (abandon.length) await this.run("UPDATE private.interviews SET status = 'abandoned' WHERE visit_id = $1 AND status = 'draft' AND id = ANY($2::uuid[])", [id, abandon]);
    const r = await this.run(
      `UPDATE private.field_visits SET status = 'ended', ended_at = now() WHERE id = $1 AND status = 'active'
          AND NOT EXISTS (SELECT 1 FROM private.interviews i WHERE i.visit_id = $1 AND i.status = 'draft' AND i.id <> ALL($2::uuid[])) RETURNING *`,
      [id, keep],
    );
    if (!r.rows[0]) {
      const again = await this.getVisit(id);
      throw new FieldRepoError("pending_drafts", again?.openDrafts.filter((d) => !keep.includes(d)) ?? []);
    }
    return visit(r.rows[0]);
  }

  async getInterview(id: string): Promise<(InterviewRecord & { answers: Answers }) | null> {
    if (!UUID.test(id)) return null;
    const r = await this.db.query("SELECT * FROM private.interviews WHERE id = $1", [id]);
    if (!r.rows[0]) return null;
    const a = await this.db.query("SELECT question_code, value, missing_reason FROM private.interview_answers WHERE interview_id = $1 ORDER BY question_code", [id]);
    const answers: Answers = {};
    for (const x of a.rows) answers[x["question_code"] as string] = x["missing_reason"] ? { missing: x["missing_reason"] as never } : { value: x["value"] as never };
    return { ...interview(r.rows[0]), answers };
  }

  /** Idempotent: the same client UUID with the same details returns the existing interview (a repeated tap or retry never makes a second one). */
  async startInterview(a: { id: string; visitId: string; collectorId: string; studyAreaId: string; surveyVersionId: string; startedAt: string; startedOffsetMinutes: number }): Promise<{ interview: InterviewRecord; created: boolean }> {
    const existing = await this.db.query("SELECT * FROM private.interviews WHERE id = $1", [a.id]);
    const same = (r: InterviewRecord) => r.visitId === a.visitId && r.collectorId === a.collectorId && r.surveyVersionId === a.surveyVersionId && r.startedAt === iso(a.startedAt) && r.startedOffsetMinutes === a.startedOffsetMinutes;
    if (existing.rows[0]) {
      const rec = interview(existing.rows[0]);
      if (!same(rec)) throw new FieldRepoError("conflict");
      return { interview: rec, created: false };
    }
    try {
      const r = await this.run(
        "INSERT INTO private.interviews (id, visit_id, study_area_id, collector_id, survey_version_id, started_at, started_offset_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [a.id, a.visitId, a.studyAreaId, a.collectorId, a.surveyVersionId, a.startedAt, a.startedOffsetMinutes],
      );
      return { interview: interview(r.rows[0]!), created: true };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {                       // two taps raced: the other one won
        const again = await this.db.query("SELECT * FROM private.interviews WHERE id = $1", [a.id]);
        const rec = interview(again.rows[0]!);
        if (!same(rec)) throw new FieldRepoError("conflict");
        return { interview: rec, created: false };
      }
      throw e;
    }
  }

  async saveAnswers(interviewId: string, answers: Record<string, Answer>): Promise<void> {
    for (const [code, a] of Object.entries(answers)) {
      const value = "value" in a ? JSON.stringify(a.value) : null;
      const missing = "missing" in a ? a.missing : null;
      await this.run(
        `INSERT INTO private.interview_answers (interview_id, question_code, value, missing_reason) VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (interview_id, question_code) DO UPDATE SET value = EXCLUDED.value, missing_reason = EXCLUDED.missing_reason`,
        [interviewId, code, value, missing],
      );
    }
  }
}
