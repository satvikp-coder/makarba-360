import type { Request, RequestHandler } from "express";
import type { Authorizer, Context, Principal, Resource } from "@makarba/authz";

export interface PrincipalSource {
  loadPrincipal(userId: string): Promise<Principal | null>;
}

/**
 * Server-side authorization for a private route (deny by default). Requires req.session
 * (see requireSession). The resolver derives the resource from trusted server data, never
 * from client-supplied ownership claims. The response never explains why access was denied.
 */
export function requirePermission(
  authz: Authorizer,
  principals: PrincipalSource,
  action: string,
  resolve: (req: Request) => Promise<Resource> | Resource = () => ({}),
  context: (req: Request) => Context = () => ({}),
): RequestHandler {
  return async (req, res, next) => {
    if (!req.session) {
      return void res.status(401).json({ code: "UNAUTHENTICATED", message: "Sign in required", fieldErrors: {}, requestId: "n/a", retryable: false });
    }
    const principal = await principals.loadPrincipal(req.session.userId);
    const decision = authz.can(principal, action, await resolve(req), context(req));
    if (!decision.allow) {
      return void res.status(403).json({ code: "FORBIDDEN", message: "You do not have access to this resource", fieldErrors: {}, requestId: "n/a", retryable: false });
    }
    next();
  };
}
