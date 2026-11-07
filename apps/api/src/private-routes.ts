import { Router, type Request, type RequestHandler } from "express";
import type { Authorizer, Context, Resource } from "@makarba/authz";
import { requireCsrf, requireSession } from "./auth-routes.js";
import { requirePermission, type PermissionAudit, type PrincipalSource } from "./permission.js";
import type { SessionService } from "@makarba/auth";

/**
 * Every private route is declared through this type, so a route cannot exist without naming the
 * capability it needs: the compiler rejects a missing `action`, and `validateRoutes` rejects an
 * action that is not in the capability matrix (typos fail closed at start-up and in tests).
 */
export interface PrivateRoute {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  /** Capability id from docs/project/contracts/capability-matrix.json. */
  action: string;
  /** Resource (study, owner, author) from trusted server data, never from client claims. */
  resolve?: (req: Request) => Promise<Resource> | Resource;
  context?: (req: Request) => Context;
  handler: RequestHandler;
}

export interface PrivateApiDeps {
  authz: Authorizer;
  principals: PrincipalSource;
  sessions: SessionService;
  routes: PrivateRoute[];
  /** Records every authorization decision (content-free). Strongly recommended outside tests. */
  audit?: PermissionAudit;
}

export function validateRoutes(authz: Authorizer, routes: PrivateRoute[]): string[] {
  const known = new Set(authz.matrix.actions.map((a) => a.id));
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) errs.push(`duplicate route ${key}`);
    seen.add(key);
    if (!known.has(r.action)) errs.push(`${key}: unknown capability ${r.action}`);
    else if (authz.matrix.actions.find((a) => a.id === r.action)!.scope === "public") errs.push(`${key}: a private route cannot use a public capability`);
    if (r.method !== "get" && !r.path.startsWith("/")) errs.push(`${key}: path must start with /`);
  }
  return errs;
}

/**
 * Builds the private API router: authentication, CSRF (for writes) and capability checks are applied
 * to every route by construction. Also serves GET /capabilities for the UI.
 */
export function privateApi(deps: PrivateApiDeps): Router {
  const errs = validateRoutes(deps.authz, deps.routes);
  if (errs.length) throw new Error("Invalid private routes: " + errs.join("; "));
  const r = Router();
  r.use(requireSession(deps.sessions), requireCsrf(deps.sessions));

  for (const route of deps.routes) {
    r[route.method](route.path, requirePermission(deps.authz, deps.principals, route.action, route.resolve, route.context, deps.audit), route.handler);
  }

  // Hints for the UI only. The server re-checks every request; a hidden or shown button never grants access.
  r.get("/capabilities", async (req, res) => {
    const studyAreaId = typeof req.query.studyAreaId === "string" ? req.query.studyAreaId : undefined;
    const principal = await deps.principals.loadPrincipal(req.session!.userId);
    const allowed = deps.authz.matrix.actions
      .filter((a) => a.scope !== "public")
      .filter((a) => deps.authz.can(principal, a.id, { studyAreaId, ownerId: req.session!.userId }).allow)
      .map((a) => a.id);
    res.json({ studyAreaId: studyAreaId ?? null, allowed, advisory: true });
  });
  return r;
}
