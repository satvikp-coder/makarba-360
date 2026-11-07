/**
 * Security audit events (issue #39). The event type is a closed allowlist: there is no field that
 * could carry a payload, answer, coordinate, token or free text, and the writer rejects any extra
 * key or any value that does not match its pattern, so a leak cannot be logged by accident.
 */
export const REASON_CODES = [
  "ok", "unauthenticated", "forbidden", "csrf", "session_expired", "mfa_required", "not_provisioned", "invalid_request", "break_glass",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface SecurityEvent {
  actorId?: string | null;
  action: string; // capability id such as "interview.view_private"
  outcome: "allow" | "deny";
  reasonCode: ReasonCode;
  studyAreaId?: string;
  resourceType?: string;
  resourceId?: string;
  revision?: number;
  requestId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(["actorId", "action", "outcome", "reasonCode", "studyAreaId", "resourceType", "resourceId", "revision", "requestId"]);

export class AuditError extends Error {}

/** Throws on anything that is not a clean, content-free event. */
export function validateEvent(e: SecurityEvent): SecurityEvent {
  for (const k of Object.keys(e)) if (!ALLOWED_KEYS.has(k)) throw new AuditError(`audit event has a disallowed field: ${k}`);
  if (!/^[a-z][a-z_.]{2,60}$/.test(e.action)) throw new AuditError("invalid action");
  if (e.outcome !== "allow" && e.outcome !== "deny") throw new AuditError("invalid outcome");
  if (!(REASON_CODES as readonly string[]).includes(e.reasonCode)) throw new AuditError("invalid reason code");
  for (const [k, v] of [["actorId", e.actorId], ["studyAreaId", e.studyAreaId], ["resourceId", e.resourceId]] as const) {
    if (v != null && !UUID.test(v)) throw new AuditError(`${k} must be a UUID`);
  }
  if (e.resourceType != null && !/^[a-z_]{2,40}$/.test(e.resourceType)) throw new AuditError("invalid resource type");
  if (e.revision != null && !(Number.isInteger(e.revision) && e.revision >= 0)) throw new AuditError("invalid revision");
  if (e.requestId != null && !/^[A-Za-z0-9_-]{8,64}$/.test(e.requestId)) throw new AuditError("invalid request id");
  return e;
}

export interface AuditSink {
  record(event: SecurityEvent): Promise<void>;
}

export class MemoryAuditSink implements AuditSink {
  readonly events: SecurityEvent[] = [];
  async record(e: SecurityEvent) { this.events.push({ ...validateEvent(e) }); }
}

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

export class PgAuditSink implements AuditSink {
  constructor(private readonly db: Queryable) {}
  async record(e: SecurityEvent): Promise<void> {
    validateEvent(e);
    await this.db.query(
      `INSERT INTO audit.security_events (actor_id, action, outcome, reason_code, study_area_id, resource_type, resource_id, revision, request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.actorId ?? null, e.action, e.outcome, e.reasonCode, e.studyAreaId ?? null, e.resourceType ?? null, e.resourceId ?? null, e.revision ?? null, e.requestId ?? null],
    );
  }
}

/** Sink that never throws into the request path: audit failure is reported, not silently swallowed. */
export function failSafe(inner: AuditSink, onError: (e: unknown) => void): AuditSink {
  return { record: async (e) => { try { await inner.record(e); } catch (err) { onError(err); } } };
}
