import type { Answer, Answers, PositionInput } from "@makarba/survey";
import type { Queryable } from "./pg-public-repository.js";

export type FieldErrorCode = "not_found" | "revision_race" | "cannot_submit" | "review_refused" | "pending_drafts" | "conflict" | "rejected_value" | "consent_required" | "not_active" | "not_draft";
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
        if (/submits|only a draft can be submitted|position .*before submitting|consent is not in force/.test(m)) throw new FieldRepoError("cannot_submit");
        if (/review/.test(m) && !/consent/.test(m)) throw new FieldRepoError("review_refused");
        if (/consent/.test(m)) throw new FieldRepoError("consent_required");
        if (/not active|frozen/.test(m)) throw new FieldRepoError("not_active");
        if (/only change while/.test(m)) throw new FieldRepoError("not_draft");
        if (/revision must be the next/.test(m)) throw new FieldRepoError("revision_race");
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

  /** Appends the next position revision. Raw device readings are never overwritten: a manual pin keeps the last device reading as `raw`. */
  async recordPosition(interviewId: string, actorId: string, v: PositionInput): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await this.db.query("SELECT revision, ST_X(raw_geometry) AS rx, ST_Y(raw_geometry) AS ry FROM private.interview_positions WHERE interview_id = $1 ORDER BY revision DESC LIMIT 1", [interviewId]);
      const next = last.rows[0] ? (last.rows[0]["revision"] as number) + 1 : 1;
      const hasPoint = v.lat !== undefined && v.lon !== undefined;
      const prevRaw = last.rows[0]?.["rx"] != null ? [last.rows[0]["rx"] as number, last.rows[0]["ry"] as number] : null;
      const raw = v.state === "device_fix" ? [v.lon!, v.lat!] : v.state === "manual_pin" ? prevRaw : null;
      try {
        await this.run(
          `INSERT INTO private.interview_positions (interview_id, revision, state, permission_state, raw_geometry, geometry, accuracy_m, captured_at, reason, recorded_by)
           VALUES ($1, $2, $3, $4, CASE WHEN $5::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4326) END,
                   CASE WHEN $7::boolean THEN ST_SetSRID(ST_MakePoint($8::float8, $9::float8), 4326) ELSE NULL END, $10, $11, $12, $13)`,
          [interviewId, next, v.state, v.permissionState, raw ? raw[0] : null, raw ? raw[1] : null, hasPoint, v.lon ?? null, v.lat ?? null, v.accuracyM ?? null, v.capturedAt ?? null, v.reason ?? null, actorId],
        );
        return;
      } catch (e) {
        if (e instanceof FieldRepoError && e.code === "revision_race" && attempt < 2) continue;
        if ((e as { code?: string }).code === "23505" && attempt < 2) continue;
        throw e;
      }
    }
  }

  async positions(interviewId: string) {
    if (!UUID.test(interviewId)) return [];
    const r = await this.db.query(
      `SELECT revision, state, permission_state, ST_X(geometry) AS x, ST_Y(geometry) AS y, ST_X(raw_geometry) AS rx, ST_Y(raw_geometry) AS ry, accuracy_m, captured_at, reason, recorded_at
         FROM private.interview_positions WHERE interview_id = $1 ORDER BY revision`, [interviewId]);
    return r.rows.map((x) => ({
      revision: x["revision"] as number, state: x["state"] as string, permissionState: x["permission_state"] as string,
      effective: x["x"] == null ? null : { lon: x["x"] as number, lat: x["y"] as number }, raw: x["rx"] == null ? null : { lon: x["rx"] as number, lat: x["ry"] as number },
      accuracyM: x["accuracy_m"] == null ? null : Number(x["accuracy_m"]), capturedAt: x["captured_at"] ? iso(x["captured_at"]) : null, reason: (x["reason"] as string | null) ?? null, recordedAt: iso(x["recorded_at"]),
    }));
  }

  /** One subject place per topic group. Either an existing place, or a candidate geometry of its own (never copied from the interview position). */
  async setSubject(interviewId: string, topicGroup: number, s: { locationId?: string; candidateGeometry?: unknown; note?: string; sameSpotConfirmed: boolean }): Promise<void> {
    await this.run(
      `INSERT INTO private.subject_places (interview_id, topic_group, location_id, candidate_geometry, candidate_note, same_spot_confirmed)
       VALUES ($1, $2, $3, CASE WHEN $4::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326) END, $5, $6)
       ON CONFLICT (interview_id, topic_group) DO UPDATE SET location_id = EXCLUDED.location_id, candidate_geometry = EXCLUDED.candidate_geometry,
         candidate_note = EXCLUDED.candidate_note, same_spot_confirmed = EXCLUDED.same_spot_confirmed`,
      [interviewId, topicGroup, s.locationId ?? null, s.candidateGeometry ? JSON.stringify(s.candidateGeometry) : null, s.note ?? null, s.sameSpotConfirmed],
    );
  }

  async subjects(interviewId: string) {
    if (!UUID.test(interviewId)) return [];
    const r = await this.db.query("SELECT topic_group, location_id, ST_AsGeoJSON(candidate_geometry)::json AS candidate, candidate_note, same_spot_confirmed FROM private.subject_places WHERE interview_id = $1 ORDER BY topic_group", [interviewId]);
    return r.rows.map((x) => ({ topicGroup: x["topic_group"] as number, locationId: (x["location_id"] as string | null) ?? null, candidateGeometry: x["candidate"] ?? null, note: (x["candidate_note"] as string | null) ?? null, sameSpotConfirmed: x["same_spot_confirmed"] as boolean }));
  }

  /** Always recorded as PENDING; verification is a separate act by a different person. */
  async recordClaim(interviewId: string, claimedBy: string, role: string): Promise<{ status: string; claimedRole: string; created: boolean }> {
    const r = await this.run("INSERT INTO private.official_claims (interview_id, claimed_role, claimed_by) VALUES ($1, $2, $3) ON CONFLICT (interview_id) DO NOTHING RETURNING status", [interviewId, role, claimedBy]);
    const cur = await this.db.query("SELECT status, claimed_role FROM private.official_claims WHERE interview_id = $1", [interviewId]);
    return { status: cur.rows[0]!["status"] as string, claimedRole: cur.rows[0]!["claimed_role"] as string, created: r.rows.length > 0 };
  }

  async getClaim(interviewId: string) {
    if (!UUID.test(interviewId)) return null;
    const r = await this.db.query("SELECT status, claimed_role, claimed_at FROM private.official_claims WHERE interview_id = $1", [interviewId]);
    return r.rows[0] ? { status: r.rows[0]["status"] as string, claimedRole: r.rows[0]["claimed_role"] as string, claimedAt: iso(r.rows[0]["claimed_at"]) } : null;
  }

  /** The only way a draft becomes submitted (database function). Idempotent. `prune` = answered questions hidden by the final answers. */
  async submit(interviewId: string, actorId: string, prune: string[]): Promise<"submitted" | "already_submitted"> {
    const r = await this.run("SELECT private.submit_interview($1::uuid, $2::uuid, $3::text[]) AS outcome", [interviewId, actorId, prune]);
    return r.rows[0]!["outcome"] as "submitted" | "already_submitted";
  }

  /** The collector's own submission history, newest first. */
  async submissions(collectorId: string, studyAreaId: string, limit = 50) {
    const r = await this.db.query(
      `SELECT i.id, i.status, i.started_at, i.submitted_at, coalesce(s.review_status, CASE WHEN i.status = 'submitted' THEN 'pending' END) AS review_status
         FROM private.interviews i LEFT JOIN private.interview_review_status s ON s.interview_id = i.id
        WHERE i.collector_id = $1 AND i.study_area_id = $2 ORDER BY coalesce(i.submitted_at, i.started_at) DESC, i.id LIMIT $3`, [collectorId, studyAreaId, limit]);
    return r.rows.map((x) => ({ id: x["id"] as string, status: x["status"] as string, startedAt: iso(x["started_at"]), submittedAt: x["submitted_at"] ? iso(x["submitted_at"]) : null, reviewStatus: (x["review_status"] as string | null) ?? null }));
  }

  /** Independent review decision (verification path; there is no HTTP route until the capability matrix has an action for it, issue #6). */
  async decideReview(interviewId: string, reviewerId: string, decision: "approved" | "changes_requested" | "rejected", note?: string): Promise<void> {
    await this.run("INSERT INTO private.interview_reviews (interview_id, decision, reviewer_id, note) VALUES ($1, $2, $3, $4)", [interviewId, decision, reviewerId, note ?? null]);
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
