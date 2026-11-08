import type { Queryable } from "./pg-public-repository.js";
import { consentFlags, type ConsentDecision, type ConsentEvent, type ConsentFlags, type ConsentRefusal, type ConsentScope } from "./consent.js";

export class ConsentRepoError extends Error {
  constructor(public code: ConsentRefusal | "rejected_value" | "not_found") { super(code); }
}

export interface ConsentView { interviewId: string; studyAreaId: string; state: Record<string, ConsentDecision | null>; flags: ConsentFlags; events: { scope: ConsentScope; decision: ConsentDecision; recordedAt: string; scriptVersion: string; language: string }[] }

const MESSAGE_TO_CODE: [RegExp, ConsentRefusal][] = [
  [/not approved/, "script_not_approved"], [/cannot be overwritten/, "overwrite_blocked"], [/already granted/, "already_granted"],
  [/nothing to withdraw/, "nothing_to_withdraw"], [/participation consent must be granted/, "participation_required"],
];

export class PgConsentRepository {
  constructor(private db: Queryable) {}

  /** Owner and study of an interview's consent, taken from the first stored event (never from the request). */
  async origin(interviewId: string): Promise<{ studyAreaId: string; ownerId: string } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(interviewId)) return null;
    const r = await this.db.query("SELECT study_area_id, recorded_by FROM private.consent_events WHERE interview_id = $1 ORDER BY id LIMIT 1", [interviewId]);
    return r.rows[0] ? { studyAreaId: r.rows[0]["study_area_id"] as string, ownerId: r.rows[0]["recorded_by"] as string } : null;
  }

  async record(a: { interviewId: string; studyAreaId: string; scope: ConsentScope; decision: ConsentDecision; scriptVersionId: string; language: string; actorId: string }): Promise<ConsentView> {
    try {
      await this.db.query(
        "INSERT INTO private.consent_events (interview_id, study_area_id, scope, decision, script_version_id, language, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [a.interviewId, a.studyAreaId, a.scope, a.decision, a.scriptVersionId, a.language, a.actorId],
      );
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "23001") {
        const hit = MESSAGE_TO_CODE.find(([re]) => re.test(err.message ?? ""));
        throw new ConsentRepoError(hit ? hit[1] : "rejected_value");
      }
      if (err.code && ["23503", "23514", "22P02"].includes(err.code)) throw new ConsentRepoError("rejected_value");
      throw e;
    }
    return (await this.view(a.interviewId))!;
  }

  async view(interviewId: string): Promise<ConsentView | null> {
    if (!/^[0-9a-f-]{36}$/i.test(interviewId)) return null;
    const r = await this.db.query(
      `SELECT e.scope, e.decision, e.recorded_at, e.study_area_id, e.language, s.version
         FROM private.consent_events e JOIN private.consent_script_versions s ON s.id = e.script_version_id
        WHERE e.interview_id = $1 ORDER BY e.id`, [interviewId]);
    if (!r.rows.length) return null;
    const events = r.rows.map((x) => ({ scope: x["scope"] as ConsentScope, decision: x["decision"] as ConsentDecision, recordedAt: new Date(x["recorded_at"] as string).toISOString(), scriptVersion: x["version"] as string, language: x["language"] as string }));
    const state: Record<string, ConsentDecision | null> = {};
    for (const e of events) state[e.scope] = e.decision;
    return { interviewId, studyAreaId: r.rows[0]!["study_area_id"] as string, state, flags: consentFlags(events as ConsentEvent[]), events };
  }
}
