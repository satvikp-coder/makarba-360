import { createHash } from "node:crypto";
import { canonicalJson, validateInstrument, type Instrument } from "@makarba/survey";
import type { Queryable } from "./pg-public-repository.js";

export const instrumentHash = (i: Instrument) => createHash("sha256").update(canonicalJson(i)).digest("hex");

export class SurveyError extends Error {
  constructor(public code: "invalid_instrument" | "not_found" | "hash_mismatch" | "not_published" | "already_exists" | "rejected", public details: string[] = []) { super(code); }
}

export interface SurveyVersion { id: string; code: string; status: "draft" | "published" | "retired"; instrument: Instrument; sha256: string | null; approvedBy: string | null; publishedAt: string | null }

const row = (r: Record<string, unknown>): SurveyVersion => ({
  id: r["id"] as string, code: r["code"] as string, status: r["status"] as SurveyVersion["status"], instrument: r["instrument"] as Instrument,
  sha256: (r["instrument_sha256"] as string | null) ?? null, approvedBy: (r["approved_by"] as string | null) ?? null,
  publishedAt: r["published_at"] ? new Date(r["published_at"] as string).toISOString() : null,
});

/** Read side, used by the API role. Every published version is re-hashed on read: a tampered row is refused, never served. */
export class PgSurveyRepository {
  constructor(private db: Queryable) {}

  async get(id: string): Promise<SurveyVersion | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = await this.db.query("SELECT * FROM private.survey_versions WHERE id = $1", [id]);
    return r.rows[0] ? this.verified(row(r.rows[0])) : null;
  }

  /** A version a new interview may use: published (not draft, not retired) and approved by a named authority. */
  async getUsable(id: string): Promise<SurveyVersion> {
    const v = await this.get(id);
    if (!v) throw new SurveyError("not_found");
    if (v.status !== "published") throw new SurveyError("not_published");
    return v;
  }

  async listPublished(): Promise<SurveyVersion[]> {
    const r = await this.db.query("SELECT * FROM private.survey_versions WHERE status = 'published' ORDER BY published_at, code");
    return r.rows.map((x) => this.verified(row(x)));
  }

  private verified(v: SurveyVersion): SurveyVersion {
    if (v.status !== "draft" && (v.sha256 === null || instrumentHash(v.instrument) !== v.sha256)) throw new SurveyError("hash_mismatch");
    return v;
  }
}

/** Maintenance path (run with the migrator/maintenance role, e.g. from a release script), never from an HTTP route. */
export class SurveyPublisher {
  constructor(private db: Queryable) {}

  async createDraft(instrument: Instrument, actorId: string | null): Promise<SurveyVersion> {
    const problems = validateInstrument(instrument);
    if (problems.length) throw new SurveyError("invalid_instrument", problems);
    try {
      const r = await this.db.query("INSERT INTO private.survey_versions (code, instrument, created_by) VALUES ($1, $2::jsonb, $3) RETURNING *", [instrument.code, JSON.stringify(instrument), actorId]);
      return row(r.rows[0]!);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new SurveyError("already_exists");
      throw e;
    }
  }

  /** Publishing validates the stored definition again, stamps its hash and the named approving authority, and freezes it. */
  async publish(id: string, approvedBy: string, actorId: string | null): Promise<SurveyVersion> {
    const cur = await this.db.query("SELECT * FROM private.survey_versions WHERE id = $1", [id]);
    if (!cur.rows[0]) throw new SurveyError("not_found");
    const v = row(cur.rows[0]);
    const problems = validateInstrument(v.instrument);
    if (problems.length) throw new SurveyError("invalid_instrument", problems);
    if (!approvedBy.trim()) throw new SurveyError("rejected", ["a named approving authority is required"]);
    try {
      const r = await this.db.query(
        "UPDATE private.survey_versions SET status = 'published', instrument_sha256 = $2, approved_by = $3, published_at = now(), published_by = $4 WHERE id = $1 AND status = 'draft' RETURNING *",
        [id, instrumentHash(v.instrument), approvedBy.trim(), actorId],
      );
      if (!r.rows[0]) throw new SurveyError("rejected", ["only a draft can be published"]);
      return row(r.rows[0]);
    } catch (e) {
      if (e instanceof SurveyError) throw e;
      if ((e as { code?: string }).code === "23001" || (e as { code?: string }).code === "23514") throw new SurveyError("rejected");
      throw e;
    }
  }

  async retire(id: string): Promise<void> {
    const r = await this.db.query("UPDATE private.survey_versions SET status = 'retired', retired_at = now() WHERE id = $1 AND status = 'published' RETURNING id", [id]);
    if (!r.rows[0]) throw new SurveyError("rejected", ["only a published version can be retired"]);
  }
}
