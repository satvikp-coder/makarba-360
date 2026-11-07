import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router, type Response } from "express";
import { validatePublic, type ContractKind } from "@makarba/contracts";

// Frozen, clearly synthetic H0 fixtures. Never served outside mock mode.
const bundle = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"),
);

const SCENARIOS = ["ok", "empty", "suppressed", "error"] as const;

function send(res: Response, status: number, kind: ContractKind, body: unknown): void {
  // Fail closed: never emit a payload that violates the public contract.
  const v = validatePublic(kind, body);
  if (!v.ok) {
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
    const all = req.query.scenario === "empty" ? [] : bundle.locations.features;
    send(res, 200, "locations", { ...bundle.locations, features: all.slice(0, limit), page: { limit, nextCursor: null } });
  });

  r.get("/locations/:slug/history", (req, res) => {
    const known = bundle.locations.features.some((f: { properties: { slug: string } }) => f.properties.slug === req.params.slug);
    if (!known) return send(res, 404, "error", bundle.missingMedia);
    send(res, 200, "history", req.query.scenario === "empty" ? { ...bundle.history, sources: [], events: [], comparisonPairs: [] } : bundle.history);
  });

  r.get("/insights", (req, res) => {
    if (req.query.cohort !== undefined && req.query.cohort !== "synthetic-safe" && req.query.cohort !== "synthetic-small-independent") {
      return send(res, 422, "error", bundle.invalidFilter);
    }
    const s = req.query.scenario;
    const cohorts = s === "empty" ? [] : s === "suppressed" ? bundle.insights.cohorts.filter((c: { suppressed: boolean }) => c.suppressed) : bundle.insights.cohorts;
    send(res, 200, "insights", { ...bundle.insights, cohorts });
  });

  r.get("/media/:id", (req, res) => {
    if (req.params.id !== bundle.media.id) return send(res, 404, "error", bundle.missingMedia);
    send(res, 200, "media", bundle.media);
  });

  return r;
}
