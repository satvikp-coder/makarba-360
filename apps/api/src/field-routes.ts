import type { Request, Response } from "express";
import { validateLocationGeometry } from "@makarba/gis-io";
import { validateAnswer, validateAnswers, validatePosition, visibleQuestions, type Answer } from "@makarba/survey";
import type { PrivateRoute } from "./private-routes.js";
import { FieldRepoError, type PgFieldRepository } from "./field-repository.js";
import { SurveyError, type PgSurveyRepository } from "./survey-repository.js";
import type { PgConsentRepository } from "./consent-repository.js";

/**
 * Private field routes (issues #44, #45): visits, idempotent interview start and draft answers, on existing capabilities
 * (`visit.start`, `interview.create`, `interview.view_private`, `interview.edit_draft`). Owner and study always come from the stored
 * record; a new visit's study is authorised against the caller's grants. Researchers must be trained (enforced by the Authorizer).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asObj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const problem = (res: Response, status: number, code: string, message: string, extra: object = {}, fieldErrors: Record<string, string> = {}) =>
  res.status(status).json({ code, message, fieldErrors, requestId: "n/a", retryable: false, ...extra });
const TEXT: Record<string, string> = {
  not_found: "Not found.", conflict: "This id is already used for a different interview.", rejected_value: "The value was rejected.",
  consent_required: "Participation consent must be granted before the interview starts.", not_active: "This visit is not active.",
  cannot_submit: "This interview cannot be submitted: consent must be in force and the interview position (or why there is none) recorded.", review_refused: "This review decision is not allowed.",
  not_draft: "This can only change while the interview is a draft.", revision_race: "Another position was saved at the same time. Try again.", pending_drafts: "Some interviews are still drafts. Choose to keep each for later sync or mark it abandoned.",
};

export function fieldRoutes(field: PgFieldRepository, surveys: PgSurveyRepository, consents?: PgConsentRepository): PrivateRoute[] {
  const id = (req: Request) => String(req.params["id"] ?? "");
  const user = (req: Request) => req.session!.userId;
  const visitScope = async (req: Request) => {
    if (!UUID.test(id(req))) return {};
    const v = await field.getVisit(id(req));
    return v ? { studyAreaId: v.studyAreaId, ownerId: v.researcherId } : {};
  };
  const interviewScope = async (req: Request) => {
    if (!UUID.test(id(req))) return {};
    const i = await field.getInterview(id(req));
    return i ? { studyAreaId: i.studyAreaId, ownerId: i.collectorId } : {};
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => {
    fn(req, res).catch((e) => {
      if (e instanceof FieldRepoError) {
        const status = e.code === "not_found" ? 404 : e.code === "rejected_value" ? 422 : 409;
        return problem(res, status, e.code, TEXT[e.code] ?? "Conflict.", e.ids.length ? { draftIds: e.ids } : {});
      }
      if (e instanceof SurveyError) return problem(res, e.code === "not_found" ? 404 : 409, e.code, "That questionnaire version cannot be used.");
      next(e);
    });
  };

  return [
    {
      method: "post", path: "/visits", action: "visit.start",
      resolve: (req) => { const s = asObj(req.body)["studyAreaId"]; return typeof s === "string" && UUID.test(s) ? { studyAreaId: s, ownerId: user(req) } : {}; },
      handler: wrap(async (req, res) => res.status(201).json(await field.startVisit(user(req), String(asObj(req.body)["studyAreaId"])))),
    },
    { method: "get", path: "/visits/:id", action: "visit.start", resolve: visitScope, handler: wrap(async (req, res) => res.json(await field.getVisit(id(req)))) },
    {
      method: "post", path: "/visits/:id/end", action: "visit.start", resolve: visitScope,
      handler: wrap(async (req, res) => {
        const raw = asObj(asObj(req.body)["reconcile"]);
        const reconcile: Record<string, "keep" | "abandon"> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (!UUID.test(k) || (v !== "keep" && v !== "abandon")) return problem(res, 422, "validation_failed", "reconcile must map interview ids to keep or abandon.", {}, { reconcile: "invalid" });
          reconcile[k] = v;
        }
        return res.json(await field.endVisit(id(req), reconcile));
      }),
    },
    {
      method: "post", path: "/visits/:id/interviews", action: "interview.create", resolve: visitScope,
      handler: wrap(async (req, res) => {
        const b = asObj(req.body);
        const errs: Record<string, string> = {};
        if (typeof b["id"] !== "string" || !UUID.test(b["id"])) errs["id"] = "a client-generated UUID is required";
        if (typeof b["surveyVersionId"] !== "string" || !UUID.test(b["surveyVersionId"])) errs["surveyVersionId"] = "required";
        const when = typeof b["startedAt"] === "string" ? new Date(b["startedAt"]) : null;
        if (!when || Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 5 * 60_000) errs["startedAt"] = "a real time that is not in the future";
        if (!Number.isInteger(b["startedOffsetMinutes"]) || Math.abs(b["startedOffsetMinutes"] as number) > 840) errs["startedOffsetMinutes"] = "minutes from UTC";
        if (Object.keys(errs).length) return problem(res, 422, "validation_failed", "Check the highlighted fields.", {}, errs);
        const v = (await field.getVisit(id(req)))!;
        await surveys.getUsable(String(b["surveyVersionId"]));               // published, approved, not retired
        const out = await field.startInterview({ id: String(b["id"]), visitId: v.id, collectorId: v.researcherId, studyAreaId: v.studyAreaId, surveyVersionId: String(b["surveyVersionId"]), startedAt: when!.toISOString(), startedOffsetMinutes: b["startedOffsetMinutes"] as number });
        return res.status(out.created ? 201 : 200).json(out.interview);
      }),
    },
    {
      method: "get", path: "/interviews/:id", action: "interview.view_private", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const i = await field.getInterview(id(req));
        if (!i) return problem(res, 404, "not_found", TEXT["not_found"]!);
        const v = await surveys.get(i.surveyVersionId);
        const visible = v ? visibleQuestions(v.instrument, i.answers).map((q) => q.code) : [];
        return res.json({ ...i, visibleQuestions: visible, staleHiddenAnswers: Object.keys(i.answers).filter((c) => !visible.includes(c)) });
      }),
    },
    {
      method: "post", path: "/interviews/:id/position", action: "gps.capture", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const check = validatePosition(req.body);
        if (!check.ok) return problem(res, 422, "validation_failed", "Check the highlighted fields.", {}, check.errors);
        await field.recordPosition(id(req), user(req), check.value);
        const all = await field.positions(id(req));
        return res.status(201).json({ positions: all, current: all[all.length - 1] ?? null, quality: check.quality });
      }),
    },
    { method: "get", path: "/interviews/:id/positions", action: "interview.view_private", resolve: interviewScope, handler: wrap(async (req, res) => res.json({ positions: await field.positions(id(req)) })) },
    {
      method: "put", path: "/interviews/:id/subjects/:group", action: "subject_location.link", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const group = Number(req.params["group"]);
        if (!Number.isInteger(group) || group < 1 || group > 20) return problem(res, 422, "validation_failed", "Topic group must be 1 to 20.", {}, { group: "1..20" });
        const b = asObj(req.body);
        if (b["sameSpotConfirmed"] !== undefined && typeof b["sameSpotConfirmed"] !== "boolean") return problem(res, 422, "validation_failed", "sameSpotConfirmed must be true or false.", {}, { sameSpotConfirmed: "boolean" });
        const sameSpot = b["sameSpotConfirmed"] === true;
        const note = typeof b["note"] === "string" && b["note"].trim() ? b["note"].trim().slice(0, 300) : undefined;
        if (b["locationId"] !== undefined) {
          if (typeof b["locationId"] !== "string" || !UUID.test(b["locationId"]) || b["geometry"] !== undefined) return problem(res, 422, "validation_failed", "Choose an existing place OR give a candidate geometry.", {}, { locationId: "a place id, without a geometry" });
          await field.setSubject(id(req), group, { locationId: b["locationId"], sameSpotConfirmed: sameSpot });
        } else {
          const g = validateLocationGeometry({ crs: b["crs"], geometry: b["geometry"], provenance: { source: "interview subject place", method: "reported" } });
          if (!g.ok) return problem(res, 422, "validation_failed", "Check the geometry.", {}, { geometry: g.reasons.join("; ") });
          await field.setSubject(id(req), group, { candidateGeometry: g.geometry, note, sameSpotConfirmed: sameSpot });
        }
        return res.json({ subjects: await field.subjects(id(req)) });
      }),
    },
    { method: "get", path: "/interviews/:id/subjects", action: "interview.view_private", resolve: interviewScope, handler: wrap(async (req, res) => res.json({ subjects: await field.subjects(id(req)) })) },
    {
      method: "post", path: "/interviews/:id/official-claim", action: "interview.edit_draft", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const role = asObj(req.body)["claimedRole"];
        if (typeof role !== "string" || !role.trim() || role.trim().length > 120) return problem(res, 422, "validation_failed", "Say which official role the participant claims.", {}, { claimedRole: "1 to 120 characters" });
        const out = await field.recordClaim(id(req), user(req), role.trim());
        return res.status(out.created ? 201 : 200).json({ status: out.status, claimedRole: out.claimedRole, verified: false });   // the collector's claim is never "verified"
      }),
    },
    { method: "get", path: "/interviews/:id/official-claim", action: "interview.view_private", resolve: interviewScope, handler: wrap(async (req, res) => { const c = await field.getClaim(id(req)); return c ? res.json(c) : problem(res, 404, "not_found", TEXT["not_found"]!); }) },
    {
      method: "post", path: "/interviews/:id/submit", action: "interview.edit_draft", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const i = await field.getInterview(id(req));
        if (!i) return problem(res, 404, "not_found", TEXT["not_found"]!);
        const v = await surveys.get(i.surveyVersionId);
        if (!v) return problem(res, 404, "not_found", TEXT["not_found"]!);
        const visible = new Set(visibleQuestions(v.instrument, i.answers).map((q) => q.code));
        const kept = Object.fromEntries(Object.entries(i.answers).filter(([c]) => visible.has(c)));
        const dropped = Object.keys(i.answers).filter((c) => !visible.has(c));
        if (i.status === "draft") {
          const check = validateAnswers(v.instrument, kept);
          if (!check.ok) return problem(res, 422, "validation_failed", "Some answers are missing or invalid.", {}, Object.fromEntries(check.errors.map((e) => [e.split(":")[0]!, e])));
        }
        const outcome = await field.submit(i.id, user(req), dropped);
        const done = (await field.getInterview(i.id))!;
        const positions = await field.positions(i.id);
        const cv = consents ? await consents.view(i.id) : null;
        return res.status(outcome === "submitted" ? 201 : 200).json({
          outcome, status: done.status,
          saveState: "saved on the server",                        // the server confirmed the write; a client that did not get this response must treat it as unsaved and retry (the call is idempotent)
          consent: cv ? cv.flags : null,
          interviewPosition: positions.length ? { state: positions[positions.length - 1]!.state, revisions: positions.length } : null,
          subjectPlaces: (await field.subjects(i.id)).length,
          answers: Object.keys(done.answers).length, droppedHiddenAnswers: outcome === "submitted" ? dropped : [],
        });
      }),
    },
    {
      method: "get", path: "/submissions", action: "interview.view_private",
      resolve: (req) => { const s = req.query["studyAreaId"]; return typeof s === "string" && UUID.test(s) ? { studyAreaId: s, ownerId: user(req) } : {}; },
      handler: wrap(async (req, res) => res.json({ items: await field.submissions(user(req), String(req.query["studyAreaId"])) })),
    },
    {
      method: "put", path: "/interviews/:id/answers", action: "interview.edit_draft", resolve: interviewScope,
      handler: wrap(async (req, res) => {
        const i = await field.getInterview(id(req));
        if (!i) return problem(res, 404, "not_found", TEXT["not_found"]!);
        if (i.status !== "draft") return problem(res, 409, "not_draft", TEXT["not_draft"]!);
        const v = await surveys.get(i.surveyVersionId);
        if (!v) return problem(res, 404, "not_found", TEXT["not_found"]!);
        const given = asObj(asObj(req.body)["answers"]);
        const errs: Record<string, string> = {};
        const byCode = new Map(v.instrument.questions.map((q) => [q.code, q]));
        if (Object.keys(given).length === 0 || Object.keys(given).length > 200) errs["answers"] = "send between 1 and 200 answers";
        for (const [code, a] of Object.entries(given)) {
          const q = byCode.get(code);
          if (!q) { errs[code] = "not a question in this version"; continue; }
          const p = validateAnswer(q, a);
          if (p.length) errs[code] = p.join("; ");
        }
        if (Object.keys(errs).length) return problem(res, 422, "validation_failed", "Check the highlighted answers.", {}, errs);
        await field.saveAnswers(i.id, given as Record<string, Answer>);
        const saved = (await field.getInterview(i.id))!;
        const visible = visibleQuestions(v.instrument, saved.answers).map((q) => q.code);
        return res.json({ ...saved, visibleQuestions: visible, staleHiddenAnswers: Object.keys(saved.answers).filter((c) => !visible.includes(c)) });
      }),
    },
  ];
}
