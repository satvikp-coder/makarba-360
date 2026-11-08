import type { Request, Response } from "express";
import { validateLocationGeometry } from "@makarba/gis-io";
import type { PrivateRoute } from "./private-routes.js";
import { LocationRepoError, type LocationRepository } from "./location-repository.js";

/**
 * Private location-geometry routes (issue #27). They use only capabilities that already exist in the (still PROPOSED) matrix:
 * `location.propose_geometry` (researcher, own) to create and change, `location.review_geometry` (lead, assigned) to read, list,
 * see revisions and review. A reviewer can never review a geometry they authored. Ownership comes from the stored record, never
 * from the request. Bodies are validated here and again by the database.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem = (res: Response, status: number, code: string, message: string, fieldErrors: Record<string, string> = {}, extra: object = {}) =>
  res.status(status).json({ code, message, fieldErrors, requestId: "n/a", retryable: false, ...extra });
const uid = (req: Request) => req.session!.userId;
const idParam = (req: Request) => String(req.params["id"] ?? "");
const asObj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function mapError(res: Response, e: unknown) {
  if (e instanceof LocationRepoError) {
    switch (e.code) {
      case "not_found": return problem(res, 404, "not_found", "Not found.");
      case "stale": return problem(res, 409, "stale_revision", "This place changed since you loaded it. Reload and try again.", {}, { currentRevision: e.currentRevision });
      case "unchanged": return problem(res, 409, "unchanged", "Nothing changed.", {}, { currentRevision: e.currentRevision });
      case "own_work": return problem(res, 409, "own_work", "A different person must review this geometry.");
      case "not_reviewable": return problem(res, 409, "not_reviewable", "This place is not waiting for review.");
      case "rejected_value": return problem(res, 422, "rejected_value", "The value was rejected. Check the category and geometry.");
    }
  }
  throw e;
}

export function locationRoutes(repo: LocationRepository): PrivateRoute[] {
  const stored = async (req: Request) => {
    const rec = await repo.get(idParam(req));
    return rec ? { studyAreaId: rec.studyAreaId, ownerId: rec.proposedBy ?? undefined, authorId: rec.proposedBy ?? undefined } : {};
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => { fn(req, res).catch((e) => { try { mapError(res, e); } catch (x) { next(x); } }); };

  return [
    {
      method: "post", path: "/locations", action: "location.propose_geometry",
      resolve: (req) => { const s = asObj(req.body)["studyAreaId"]; return typeof s === "string" && UUID.test(s) ? { studyAreaId: s, ownerId: uid(req) } : {}; },
      handler: wrap(async (req, res) => {
        const b = asObj(req.body);
        const fieldErrors: Record<string, string> = {};
        if (typeof b["categoryId"] !== "string") fieldErrors["categoryId"] = "required";
        const name = asObj(b["name"]);
        if (typeof name["en"] !== "string" || !name["en"].trim() || Object.values(name).some((v) => typeof v !== "string")) fieldErrors["name"] = "an English name is required and every name must be text";
        const version = b["studyAreaVersion"];
        if (!Number.isInteger(version) || (version as number) < 1) fieldErrors["studyAreaVersion"] = "required";
        const g = validateLocationGeometry({ crs: b["crs"], geometry: b["geometry"], provenance: b["provenance"] });
        if (!g.ok) fieldErrors["geometry"] = g.reasons.join("; ");
        if (Object.keys(fieldErrors).length || !g.ok) return problem(res, 422, "validation_failed", "Check the highlighted fields.", fieldErrors);
        const rec = await repo.create({ studyAreaId: String(b["studyAreaId"]), studyAreaVersion: version as number, categoryId: String(b["categoryId"]), name: name as Record<string, string>, geometry: g.geometry, provenance: g.provenance }, uid(req));
        return res.status(201).json(rec);
      }),
    },
    {
      method: "get", path: "/locations", action: "location.review_geometry",
      resolve: (req) => { const s = req.query["studyAreaId"]; return typeof s === "string" && UUID.test(s) ? { studyAreaId: s } : {}; },
      handler: wrap(async (req, res) => {
        const limit = Math.min(Math.max(Number.parseInt(String(req.query["limit"] ?? "50"), 10) || 50, 1), 100);
        const after = typeof req.query["cursor"] === "string" ? req.query["cursor"] : null;
        const rows = await repo.list(String(req.query["studyAreaId"]), limit + 1, after);
        res.json({ items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null });
      }),
    },
    { method: "get", path: "/locations/:id", action: "location.review_geometry", resolve: stored,
      handler: wrap(async (req, res) => { const r = await repo.get(idParam(req)); return r ? res.json(r) : problem(res, 404, "not_found", "Not found."); }) },
    { method: "get", path: "/locations/:id/revisions", action: "location.review_geometry", resolve: stored,
      handler: wrap(async (req, res) => res.json({ items: await repo.revisions(idParam(req)) })) },
    {
      method: "put", path: "/locations/:id/geometry", action: "location.propose_geometry", resolve: stored,
      handler: wrap(async (req, res) => {
        const b = asObj(req.body);
        const rev = b["expectedRevision"];
        const g = validateLocationGeometry({ crs: b["crs"], geometry: b["geometry"], provenance: b["provenance"] });
        const fieldErrors: Record<string, string> = {};
        if (!Number.isInteger(rev) || (rev as number) < 1) fieldErrors["expectedRevision"] = "required";
        if (!g.ok) fieldErrors["geometry"] = g.reasons.join("; ");
        if (Object.keys(fieldErrors).length || !g.ok) return problem(res, 422, "validation_failed", "Check the highlighted fields.", fieldErrors);
        res.json(await repo.proposeChange(idParam(req), rev as number, g.geometry, g.provenance, uid(req)));
      }),
    },
    {
      method: "post", path: "/locations/:id/review", action: "location.review_geometry", resolve: stored,
      handler: wrap(async (req, res) => {
        const rev = asObj(req.body)["expectedRevision"];
        if (!Number.isInteger(rev) || (rev as number) < 1) return problem(res, 422, "validation_failed", "Check the highlighted fields.", { expectedRevision: "required" });
        res.json(await repo.review(idParam(req), rev as number, uid(req)));
      }),
    },
  ];
}
