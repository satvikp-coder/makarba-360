import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router, type Response } from "express";
import { findForbiddenField, validatePublic, type ContractKind } from "@makarba/contracts";
import { demoCohorts, demoHistory, demoInsights, demoLocations, demoMedia, demoSlugs, demoStories } from "./demo-makarba.js";

// Shared error shapes come from the frozen contract fixtures. The served CONTENT is the illustrative Makarba demo dataset
// (./demo-makarba.ts): fictional, labelled synthetic, never served outside mock mode.
const bundle = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"),
);

const SCENARIOS = ["ok", "empty", "suppressed", "error"] as const;
const COHORTS = new Set(demoCohorts.map((c) => c.cohortId));

function send(res: Response, status: number, kind: ContractKind | "stories", body: unknown): void {
  // Fail closed: never emit a payload that violates the public contract (stories: proposed contract, private-field check only).
  const ok = kind === "stories" ? findForbiddenField(body) === null : validatePublic(kind, body).ok;
  if (!ok) {
    res.status(500).json({ ...bundle.invalidFilter, code: "CONTRACT_VIOLATION", message: "mock payload failed contract validation", retryable: false });
    return;
  }
  res.status(status).json(body);
}

export function mockRouter(): Router {
  const r = Router();
  r.use((req, res, next) => {
    const s = String(req.query.scenario ?? "ok");
    if (!(SCENARIOS as readonly string[]).includes(s)) {
      return send(res, 422, "error", { ...bundle.invalidFilter, fieldErrors: { scenario: "Unsupported scenario" } });
    }
    if (s === "error") {
      return send(res, 503, "error", { code: "UNAVAILABLE", message: "Synthetic transient failure", fieldErrors: {}, requestId: "synthetic-request-503", retryable: true });
    }
    next();
  });

  r.get("/locations", (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return send(res, 422, "error", { ...bundle.invalidFilter, fieldErrors: { limit: "Must be an integer 1-200" } });
    }
    const all = req.query.scenario === "empty" ? [] : demoLocations.features;
    send(res, 200, "locations", { ...demoLocations, features: all.slice(0, limit), page: { limit, nextCursor: null } });
  });

  r.get("/locations/:slug/history", (req, res) => {
    const h = demoSlugs.includes(req.params.slug) ? demoHistory(req.params.slug) : null;
    if (!h) return send(res, 404, "error", bundle.missingMedia);
    send(res, 200, "history", req.query.scenario === "empty" ? { ...h, sources: [], events: [], comparisonPairs: [] } : h);
  });

  r.get("/insights", (req, res) => {
    if (req.query.cohort !== undefined && !COHORTS.has(String(req.query.cohort))) {
      return send(res, 422, "error", bundle.invalidFilter);
    }
    const s = req.query.scenario;
    const cohorts = s === "empty" ? [] : s === "suppressed" ? demoInsights.cohorts.filter((c) => c.suppressed) : demoInsights.cohorts;
    send(res, 200, "insights", { ...demoInsights, cohorts });
  });

  r.get("/media/:id", (req, res) => {
    if (req.params.id !== demoMedia.id) return send(res, 404, "error", bundle.missingMedia);
    send(res, 200, "media", demoMedia);
  });

  r.get("/stories", (req, res) => {
    send(res, 200, "stories", req.query.scenario === "empty" ? { ...demoStories, stories: [] } : demoStories);
  });

  return r;
}
