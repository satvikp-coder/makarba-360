import type { Request, RequestHandler } from "express";
import type { AuditSink, ReasonCode } from "@makarba/audit";
import type { Authorizer, Context, Principal, Resource } from "@makarba/authz";

export interface PrincipalSource {
  loadPrincipal(userId: string): Promise<Principal | null>;
}

export interface PermissionAudit {
  sink: AuditSink;
  /** Reports an audit failure without including any request content. */
  onError?: (e: unknown) => void;
}

const body = (code: string, message: string) => ({ code, message, fieldErrors: {}, requestId: "n/a", retryable: false });

/**
 * Server-side authorization for a private route (deny by default). Requires req.session
 * (see requireSession). The resolver derives the resource from trusted server data, never
 * from client-supplied ownership claims. The response never explains why access was denied.
 *
 * When an audit sink is supplied every decision is recorded (actor, action, outcome, reason
 * code, study and record identifiers only). An *allowed* decision that cannot be audited is
 * refused (fail closed); a denied one stays denied.
 */
export function requirePermission(
  authz: Authorizer,
  principals: PrincipalSource,
  action: string,
  resolve: (req: Request) => Promise<Resource> | Resource = () => ({}),
  context: (req: Request) => Context = () => ({}),
  audit?: PermissionAudit,
): RequestHandler {
  const record = async (req: Request, outcome: "allow" | "deny", reasonCode: ReasonCode, resource: Resource) => {
    if (!audit) return true;
    try {
      await audit.sink.record({
        actorId: req.session?.userId ?? null, action, outcome, reasonCode,
        studyAreaId: resource.studyAreaId,
        requestId: typeof req.headers["x-request-id"] === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(req.headers["x-request-id"]) ? req.headers["x-request-id"] : undefined,
      });
      return true;
    } catch (e) {
      audit.onError?.(e);
      return false;
    }
  };

  return async (req, res, next) => {
    if (!req.session) {
      await record(req, "deny", "unauthenticated", {});
      return void res.status(401).json(body("UNAUTHENTICATED", "Sign in required"));
    }
    const resource = await resolve(req);
    const principal = await principals.loadPrincipal(req.session.userId);
    const decision = authz.can(principal, action, resource, context(req));
    if (!decision.allow) {
      await record(req, "deny", "forbidden", resource);
      return void res.status(403).json(body("FORBIDDEN", "You do not have access to this resource"));
    }
    if (!(await record(req, "allow", "ok", resource))) {
      return void res.status(503).json({ ...body("AUDIT_UNAVAILABLE", "The request could not be recorded; try again"), retryable: true });
    }
    next();
  };
}
