import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Role = "visitor" | "researcher" | "lead" | "reviewer" | "administrator";
export type Access = "read" | "own" | "assigned" | "grant";

export interface MatrixAction {
  id: string;
  description: string;
  scope: "public" | "study" | "record" | "system";
  ownership_policy: string;
  grants: Partial<Record<Role, Access>>;
}
export interface CapabilityMatrix {
  status: string;
  approved_by: string | null;
  approved_on: string | null;
  roles: Role[];
  actions: MatrixAction[];
}

export interface Grant {
  role: Role;
  /** null = system-wide grant (administration); otherwise the single study the grant is scoped to. */
  studyAreaId: string | null;
  expiresAt: Date | null;
}
export interface Principal {
  userId: string;
  active: boolean;
  grants: Grant[];
}
export interface Resource {
  studyAreaId?: string;
  /** User who owns the record (the researcher who collected it). */
  ownerId?: string;
  /** User who authored the content being reviewed/published. */
  authorId?: string;
}
export interface Context {
  now?: Date;
  /** Caller asserts an approved purpose exists for a restricted export (verified elsewhere). */
  purposeApproved?: boolean;
  breakGlass?: { reason: string; expiresAt: Date };
}
export type Decision = { allow: true } | { allow: false; reason: string };

export const MATRIX_URL = new URL("../../../docs/project/contracts/capability-matrix.json", import.meta.url);

export function loadMatrix(path: string | URL = MATRIX_URL): CapabilityMatrix {
  return JSON.parse(readFileSync(typeof path === "string" ? path : fileURLToPath(path), "utf8")) as CapabilityMatrix;
}

const deny = (reason: string): Decision => ({ allow: false, reason });
const MAX_BREAK_GLASS_MS = 24 * 3_600_000;

export class Authorizer {
  private readonly byId: Map<string, MatrixAction>;
  constructor(public readonly matrix: CapabilityMatrix) {
    this.byId = new Map(matrix.actions.map((a) => [a.id, a]));
  }

  get approved(): boolean {
    return !!this.matrix.approved_by && !this.matrix.status.startsWith("PROPOSED");
  }

  /**
   * Deny-by-default decision. `principal` null = anonymous visitor (public actions only).
   * Considers only active, unexpired grants; an inactive user is denied everything non-public.
   */
  can(principal: Principal | null, actionId: string, resource: Resource = {}, ctx: Context = {}): Decision {
    const action = this.byId.get(actionId);
    if (!action) return deny("unknown action");
    const now = ctx.now ?? new Date();

    if (action.scope === "public") {
      return action.grants.visitor === "read" ? { allow: true } : deny("public action without visitor read");
    }
    if (!principal) return deny("authentication required");
    if (!principal.active) return deny("user inactive");

    const live = principal.grants.filter((g) => !g.expiresAt || g.expiresAt > now);
    let lastReason = "no grant for this action";
    for (const g of live) {
      const access = action.grants[g.role];
      if (!access) continue;
      const d = this.check(principal, g, access, action, resource, ctx, now);
      if (d.allow) return d;
      lastReason = d.reason;
    }
    return deny(lastReason);
  }

  private check(p: Principal, g: Grant, access: Access, a: MatrixAction, r: Resource, ctx: Context, now: Date): Decision {
    // Ownership separation: nobody approves or publishes their own work.
    if (a.ownership_policy === "independent_reviewer" && (!r.authorId || r.authorId === p.userId)) {
      return deny("independent reviewer required (no self-approval)");
    }
    if (access === "read") return { allow: true }; // safe aggregates: no record/study scoping needed

    if (a.scope === "system" && access === "grant") {
      if (g.studyAreaId !== null) return deny("system action needs a system-wide grant");
      return { allow: true };
    }

    // Study-limited access ('own'/'assigned', or a study-scoped explicit grant): the grant must be
    // for exactly the resource's study. A system-wide (administrator) explicit grant covers any
    // study but is still subject to the action's own conditions (e.g. break-glass reason/expiry).
    if (!r.studyAreaId) return deny("resource study required");
    if (!(access === "grant" && g.studyAreaId === null) && g.studyAreaId !== r.studyAreaId) {
      return deny("grant is for a different study");
    }

    if (access === "own") {
      if (a.scope === "record" && r.ownerId !== p.userId) return deny("not the record owner");
      if (a.scope === "study" && r.ownerId !== undefined && r.ownerId !== p.userId) return deny("not the owner");
    }
    if (a.id === "breakglass.access") return this.breakGlass(ctx, now);
    if (access === "grant" && a.id === "export.restricted" && !ctx.purposeApproved) return deny("approved purpose required");
    return { allow: true };
  }

  private breakGlass(ctx: Context, now: Date): Decision {
    const b = ctx.breakGlass;
    if (!b || b.reason.trim().length < 10) return deny("break-glass needs a recorded reason");
    if (b.expiresAt <= now || b.expiresAt.getTime() - now.getTime() > MAX_BREAK_GLASS_MS) return deny("break-glass needs a short expiry (max 24h)");
    return { allow: true };
  }

  /** Role assignment: only user managers, never to oneself, never an unscoped researcher/lead/reviewer. */
  canAssignRole(actor: Principal | null, req: { targetUserId: string; role: Role; studyAreaId: string | null }, ctx: Context = {}): Decision {
    const d = this.can(actor, "user.manage", {}, ctx);
    if (!d.allow) return d;
    if (actor!.userId === req.targetUserId) return deny("cannot change your own grants");
    if (!this.matrix.roles.includes(req.role) || req.role === "visitor") return deny("invalid role");
    if (req.role === "administrator" ? req.studyAreaId !== null : req.studyAreaId === null) {
      return deny(req.role === "administrator" ? "administrator is system-scoped" : "study-scoped role needs a study");
    }
    return { allow: true };
  }
}

/**
 * Production guard: production grants must never be driven by a policy that stakeholders have not
 * approved. Local and staging may run on the PROPOSED matrix.
 */
export function assertPolicyUsable(authz: Authorizer, appEnv: "local" | "staging" | "production"): void {
  if (appEnv === "production" && !authz.approved) {
    throw new Error("Capability matrix is not approved (issue #6): refusing to start in production");
  }
}
