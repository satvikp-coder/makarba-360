import type { Request, Response } from "express";
import type { PrivateRoute } from "./private-routes.js";
import { CONSENT_SCOPES, type ConsentScope } from "./consent.js";
import { ConsentRepoError, type PgConsentRepository } from "./consent-repository.js";

/**
 * Private consent routes (issue #37), on existing capabilities only: `interview.edit_draft` (record owner) records a grant or refusal,
 * `interview.request_correction` (record owner) records a withdrawal, `interview.view_private` (owner or assigned lead) reads it.
 * Owner and study come from the first stored event; for a new interview the study comes from the body and is authorised against the
 * caller's grants. The server never accepts a decision for a scope after a refusal or withdrawal, whatever the client sends.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem = (res: Response, status: number, code: string, message: string, extra: object = {}) =>
  res.status(status).json({ code, message, fieldErrors: {}, requestId: "n/a", retryable: false, ...extra });
const asObj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const REFUSAL_TEXT: Record<string, string> = {
  script_not_approved: "This consent script version is not approved for use.",
  overwrite_blocked: "A refusal or withdrawal cannot be changed. Start a new interview if the participant now agrees.",
  already_granted: "This permission is already recorded.",
  nothing_to_withdraw: "There is no permission to withdraw.",
  participation_required: "Participation consent must be granted first.",
};

export function consentRoutes(repo: PgConsentRepository): PrivateRoute[] {
  const id = (req: Request) => String(req.params["id"] ?? "");
  const stored = async (req: Request) => {
    const o = await repo.origin(id(req));
    return o ? { studyAreaId: o.studyAreaId, ownerId: o.ownerId } : {};
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => {
    fn(req, res).catch((e) => {
      if (e instanceof ConsentRepoError) {
        if (e.code === "rejected_value") return problem(res, 422, "rejected_value", "The value was rejected.");
        if (e.code === "not_found") return problem(res, 404, "not_found", "Not found.");
        return problem(res, 409, e.code, REFUSAL_TEXT[e.code] ?? "Conflict.");
      }
      next(e);
    });
  };
  const common = (b: Record<string, unknown>) => {
    const errs: Record<string, string> = {};
    if (!(CONSENT_SCOPES as readonly unknown[]).includes(b["scope"])) errs["scope"] = `one of ${CONSENT_SCOPES.join(", ")}`;
    if (typeof b["scriptVersionId"] !== "string" || !UUID.test(b["scriptVersionId"])) errs["scriptVersionId"] = "required";
    if (typeof b["language"] !== "string" || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(b["language"])) errs["language"] = "required";
    return errs;
  };

  return [
    {
      method: "post", path: "/interviews/:id/consent", action: "interview.edit_draft",
      resolve: async (req) => {
        if (!UUID.test(id(req))) return {};
        const o = await stored(req);
        if ("studyAreaId" in o) return o;
        const s = asObj(req.body)["studyAreaId"];
        return typeof s === "string" && UUID.test(s) ? { studyAreaId: s, ownerId: req.session!.userId } : {};
      },
      handler: wrap(async (req, res) => {
        const b = asObj(req.body);
        const errs = common(b);
        if (b["decision"] !== "granted" && b["decision"] !== "refused") errs["decision"] = "granted or refused (withdrawals use the withdraw route)";
        if (Object.keys(errs).length) return res.status(422).json({ code: "validation_failed", message: "Check the highlighted fields.", fieldErrors: errs, requestId: "n/a", retryable: false });
        const o = await repo.origin(id(req));
        const view = await repo.record({
          interviewId: id(req), studyAreaId: o?.studyAreaId ?? String(b["studyAreaId"]), scope: b["scope"] as ConsentScope, decision: b["decision"] as "granted" | "refused",
          scriptVersionId: String(b["scriptVersionId"]), language: String(b["language"]), actorId: req.session!.userId,
        });
        return res.status(201).json(view);
      }),
    },
    {
      method: "post", path: "/interviews/:id/consent/withdraw", action: "interview.request_correction",
      resolve: (req) => (UUID.test(id(req)) ? stored(req) : {}),
      handler: wrap(async (req, res) => {
        const b = asObj(req.body);
        const errs = common(b);
        if (Object.keys(errs).length) return res.status(422).json({ code: "validation_failed", message: "Check the highlighted fields.", fieldErrors: errs, requestId: "n/a", retryable: false });
        const o = await repo.origin(id(req));
        if (!o) return problem(res, 404, "not_found", "Not found.");
        return res.json(await repo.record({ interviewId: id(req), studyAreaId: o.studyAreaId, scope: b["scope"] as ConsentScope, decision: "withdrawn", scriptVersionId: String(b["scriptVersionId"]), language: String(b["language"]), actorId: req.session!.userId }));
      }),
    },
    {
      method: "get", path: "/interviews/:id/consent", action: "interview.view_private",
      resolve: (req) => (UUID.test(id(req)) ? stored(req) : {}),
      handler: wrap(async (req, res) => { const v = await repo.view(id(req)); return v ? res.json(v) : problem(res, 404, "not_found", "Not found."); }),
    },
  ];
}
