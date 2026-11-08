import type { GeometryProvenance } from "@makarba/gis-io";
import type { Queryable } from "./pg-public-repository.js";

/** Private place record (candidate geometry workflow, issue #27). Place geometry only: no interview or subject positions live here. */
export interface LocationRecord {
  id: string;
  studyAreaId: string;
  categoryId: string;
  name: Record<string, string>;
  geometry: unknown;
  provenance: GeometryProvenance | null;
  revision: number;
  state: string;
  proposedBy: string | null;
  reviewedBy: string | null;
  lastReviewedAt: string | null;
}
export interface RevisionRecord { revision: number; geometry: unknown; provenance: GeometryProvenance | null; changedBy: string | null; changedAt: string }

export type RepoErrorCode = "not_found" | "stale" | "unchanged" | "own_work" | "not_reviewable" | "rejected_value";
export class LocationRepoError extends Error {
  constructor(public code: RepoErrorCode, public currentRevision?: number) { super(code); }
}

export interface NewLocation {
  id?: string;
  studyAreaId: string;
  studyAreaVersion: number;
  categoryId: string;
  name: Record<string, string>;
  geometry: unknown;
  provenance: GeometryProvenance;
}

export interface LocationRepository {
  create(input: NewLocation, actorId: string): Promise<LocationRecord>;
  get(id: string): Promise<LocationRecord | null>;
  list(studyAreaId: string, limit: number, afterId: string | null): Promise<LocationRecord[]>;
  proposeChange(id: string, expectedRevision: number, geometry: unknown, provenance: GeometryProvenance, actorId: string): Promise<LocationRecord>;
  review(id: string, expectedRevision: number, reviewerId: string): Promise<LocationRecord>;
  revisions(id: string): Promise<RevisionRecord[]>;
}

const COLS = `l.id, l.study_area_id, l.category_id, l.name, ST_AsGeoJSON(l.geometry)::json AS geometry, l.geometry_provenance, l.revision, l.state,
              l.proposed_by, l.reviewed_by, l.last_reviewed_at`;
const toRecord = (r: Record<string, unknown>): LocationRecord => ({
  id: r["id"] as string, studyAreaId: r["study_area_id"] as string, categoryId: r["category_id"] as string, name: r["name"] as Record<string, string>,
  geometry: r["geometry"], provenance: (r["geometry_provenance"] as GeometryProvenance | null) ?? null, revision: r["revision"] as number, state: r["state"] as string,
  proposedBy: (r["proposed_by"] as string | null) ?? null, reviewedBy: (r["reviewed_by"] as string | null) ?? null,
  lastReviewedAt: r["last_reviewed_at"] ? new Date(r["last_reviewed_at"] as string).toISOString() : null,
});
const GEOM_SQL = "ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)";
/** SQLSTATEs from the schema's own checks: invalid geometry, archived/unknown category, malformed value. */
const REJECTED = new Set(["23514", "23001", "23503", "22023", "XX000", "22P02", "22032"]);

export class PgLocationRepository implements LocationRepository {
  constructor(private db: Queryable) {}

  private async run(sql: string, params: unknown[]) {
    try { return await this.db.query(sql, params); }
    catch (e) {
      const code = (e as { code?: string }).code;
      if (code && REJECTED.has(code)) throw new LocationRepoError("rejected_value");
      throw e;
    }
  }

  async create(i: NewLocation, actorId: string) {
    const r = await this.run(
      `INSERT INTO private.locations (id, study_area_id, study_area_version, category_id, name, geometry, geometry_provenance, proposed_by)
       VALUES (COALESCE($7::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), $6::jsonb, $8)
       RETURNING id`,
      [JSON.stringify(i.geometry), i.studyAreaId, i.studyAreaVersion, i.categoryId, JSON.stringify(i.name), JSON.stringify(i.provenance), i.id ?? null, actorId],
    );
    return (await this.get(r.rows[0]!["id"] as string))!;
  }

  async get(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = await this.db.query(`SELECT ${COLS} FROM private.locations l WHERE l.id = $1`, [id]);
    return r.rows[0] ? toRecord(r.rows[0]) : null;
  }

  async list(studyAreaId: string, limit: number, afterId: string | null) {
    const r = await this.db.query(
      `SELECT ${COLS} FROM private.locations l WHERE l.study_area_id = $1 AND ($3::uuid IS NULL OR l.id > $3::uuid) ORDER BY l.id LIMIT $2`,
      [studyAreaId, limit, afterId && /^[0-9a-f-]{36}$/i.test(afterId) ? afterId : null],
    );
    return r.rows.map(toRecord);
  }

  async proposeChange(id: string, expectedRevision: number, geometry: unknown, provenance: GeometryProvenance, actorId: string) {
    const r = await this.run(
      `UPDATE private.locations l
          SET geometry = ${GEOM_SQL}, geometry_provenance = $2::jsonb, proposed_by = $5
        WHERE l.id = $3 AND l.revision = $4
          AND (NOT ST_OrderingEquals(l.geometry, ${GEOM_SQL}) OR l.geometry_provenance IS DISTINCT FROM $2::jsonb)
        RETURNING l.id`,
      [JSON.stringify(geometry), JSON.stringify(provenance), id, expectedRevision, actorId],
    );
    if (r.rows[0]) return (await this.get(id))!;
    const cur = await this.get(id);
    if (!cur) throw new LocationRepoError("not_found");
    if (cur.revision !== expectedRevision) throw new LocationRepoError("stale", cur.revision);
    throw new LocationRepoError("unchanged", cur.revision);
  }

  async review(id: string, expectedRevision: number, reviewerId: string) {
    const r = await this.run(
      `UPDATE private.locations SET state = 'reviewed', last_reviewed_at = now(), reviewed_by = $3
        WHERE id = $1 AND revision = $2 AND state = 'candidate' AND proposed_by IS DISTINCT FROM $3 AND geometry_provenance IS NOT NULL
        RETURNING id`,
      [id, expectedRevision, reviewerId],
    );
    if (r.rows[0]) return (await this.get(id))!;
    const cur = await this.get(id);
    if (!cur) throw new LocationRepoError("not_found");
    if (cur.revision !== expectedRevision) throw new LocationRepoError("stale", cur.revision);
    if (cur.proposedBy === reviewerId) throw new LocationRepoError("own_work");
    throw new LocationRepoError("not_reviewable");
  }

  async revisions(id: string) {
    const r = await this.db.query(
      `SELECT revision, ST_AsGeoJSON(geometry)::json AS geometry, provenance, changed_by, changed_at FROM audit.location_geometry_revisions WHERE location_id = $1 ORDER BY revision`,
      [id],
    );
    return r.rows.map((x) => ({ revision: x["revision"] as number, geometry: x["geometry"], provenance: (x["provenance"] as GeometryProvenance | null) ?? null, changedBy: (x["changed_by"] as string | null) ?? null, changedAt: new Date(x["changed_at"] as string).toISOString() }));
  }
}
