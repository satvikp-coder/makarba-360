import { InvalidFilterError, type PublicRepository } from "./public-api.js";

/** The only thing the repository needs from a database driver (satisfied by pg.Pool and pg.Client). */
export interface Queryable { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }

export interface PgPublicOptions {
  /** "approved" for real publications. Rows whose snapshot_id starts with "synthetic-" are labelled synthetic regardless. */
  datasetKind?: "approved" | "synthetic";
  methodologyUrl?: string;
}

/**
 * PublicRepository over the `published` schema ONLY (issue #81). Run it with the `makarba_public_api` role, which can read nothing else.
 * It reads rows the publication worker already wrote; it contains no filtering logic for privacy because the projection tables hold no
 * private data, and the router validates every payload against the shared contract again before sending. A withdrawn item has no row.
 */
export class PgPublicRepository implements PublicRepository {
  constructor(private db: Queryable, private opts: PgPublicOptions = {}) {}

  async listLocations({ limit, cursor }: { limit: number; cursor: string | null }) {
    const { rows } = await this.db.query(
      `SELECT l.id, l.slug, l.category_id, l.name, l.last_reviewed_at, l.snapshot_id, ST_AsGeoJSON(l.geometry)::json AS geometry,
              COALESCE((SELECT array_agg(m.id ORDER BY m.id) FROM published.media m WHERE m.location_id = l.id), '{}') AS media_ids
         FROM published.locations l
        WHERE ($2::uuid IS NULL OR l.id > $2::uuid)
        ORDER BY l.id
        LIMIT $1`,
      [limit + 1, cursor && /^[0-9a-f-]{36}$/i.test(cursor) ? cursor : null],
    );
    const page = rows.slice(0, limit);
    const synthetic = this.opts.datasetKind === "synthetic" || page.some((r) => String(r["snapshot_id"]).startsWith("synthetic-"));
    return {
      type: "FeatureCollection",
      features: page.map((r) => ({
        type: "Feature",
        id: r["id"],
        geometry: r["geometry"],
        properties: {
          locationId: r["id"], slug: r["slug"], name: r["name"], category: r["category_id"], publicationState: "published",
          lastReviewedDate: new Date(r["last_reviewed_at"] as string).toISOString().slice(0, 10), sourceIds: [], mediaIds: r["media_ids"],
        },
      })),
      page: { limit, nextCursor: rows.length > limit ? String(page[page.length - 1]!["id"]) : null },
      meta: { contractVersion: "1.0.0", datasetKind: synthetic ? "synthetic" : this.opts.datasetKind ?? "approved", snapshotId: String(page[0]?.["snapshot_id"] ?? "empty"), methodologyUrl: this.opts.methodologyUrl ?? "/research/methodology" },
    };
  }

  async getHistory(slug: string) {
    const { rows } = await this.db.query("SELECT payload FROM published.history WHERE slug = $1", [slug]);
    return rows[0]?.["payload"] ?? null;
  }

  async getMedia(id: string) {
    const { rows } = await this.db.query("SELECT payload FROM published.media WHERE id = $1", [id]);
    return rows[0]?.["payload"] ?? null;
  }

  async getInsights({ cohort }: { cohort: string | null }) {
    const { rows } = await this.db.query("SELECT payload FROM published.insights_snapshots WHERE is_current");
    const payload = rows[0]?.["payload"] as { cohorts: { cohortId: string }[] } | undefined;
    if (!payload) {
      // Nothing published yet: an empty, valid snapshot is the honest answer (never invented numbers).
      return { cohorts: [], collectionPeriod: { fromMonth: "none", throughMonth: "none" }, questionVersion: "none", policyVersion: "none", sampleNote: "No results have been published yet.", meta: { contractVersion: "1.0.0", datasetKind: this.opts.datasetKind ?? "approved", snapshotId: "none", methodologyUrl: this.opts.methodologyUrl ?? "/research/methodology" } };
    }
    if (cohort === null) return payload;
    if (!payload.cohorts.some((c) => c.cohortId === cohort)) throw new InvalidFilterError("cohort");
    return { ...payload, cohorts: payload.cohorts.filter((c) => c.cohortId === cohort) };
  }

  async getStories() {
    const { rows } = await this.db.query("SELECT payload FROM published.stories ORDER BY id");
    if (!rows.length) return null;
    return { stories: rows.map((r) => r["payload"]), meta: { contractVersion: "1.0.0", datasetKind: this.opts.datasetKind ?? "approved", snapshotId: "stories", methodologyUrl: "/research" } };
  }
}
