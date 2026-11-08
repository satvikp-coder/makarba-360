/**
 * Consent rules (issue #37), pure. The database trigger in migration 0010 enforces the same rules; a parity test runs one case table
 * through both. Each scope is an independent decision. A refusal or withdrawal is terminal for the interview (a changed mind is a NEW
 * interview with fresh consent), and withdrawing participation withdraws every granted scope. Synthetic until institutional approval (#11).
 */
export const CONSENT_SCOPES = ["participation", "recording", "aggregate_use", "identifiable_media", "identifiable_story"] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
export type ConsentDecision = "granted" | "refused" | "withdrawn";
export interface ConsentEvent { scope: ConsentScope; decision: ConsentDecision }

export type ConsentRefusal = "script_not_approved" | "overwrite_blocked" | "already_granted" | "nothing_to_withdraw" | "participation_required";
export type ConsentCheck = { ok: true } | { ok: false; reason: ConsentRefusal };

export function currentState(history: readonly ConsentEvent[]): Record<ConsentScope, ConsentDecision | null> {
  const out = Object.fromEntries(CONSENT_SCOPES.map((s) => [s, null])) as Record<ConsentScope, ConsentDecision | null>;
  for (const e of history) out[e.scope] = e.decision;
  return out;
}

export function evaluateConsent(history: readonly ConsentEvent[], next: ConsentEvent, scriptApproved: boolean): ConsentCheck {
  if (!scriptApproved && next.decision !== "withdrawn") return { ok: false, reason: "script_not_approved" };
  const state = currentState(history);
  const latest = state[next.scope];
  if (latest === "refused" || latest === "withdrawn") return { ok: false, reason: "overwrite_blocked" };
  if (latest === "granted" && next.decision !== "withdrawn") return { ok: false, reason: "already_granted" };
  if (latest === null && next.decision === "withdrawn") return { ok: false, reason: "nothing_to_withdraw" };
  if (next.scope !== "participation" && next.decision !== "withdrawn" && state.participation !== "granted") return { ok: false, reason: "participation_required" };
  return { ok: true };
}

/** Appends an event (and the cascade) or returns the refusal. Never mutates its input. */
export function applyConsent(history: readonly ConsentEvent[], next: ConsentEvent, scriptApproved: boolean): { ok: true; history: ConsentEvent[] } | { ok: false; reason: ConsentRefusal } {
  const check = evaluateConsent(history, next, scriptApproved);
  if (!check.ok) return check;
  const out = [...history, next];
  if (next.scope === "participation" && next.decision === "withdrawn") {
    const state = currentState(history);
    for (const s of CONSENT_SCOPES) if (s !== "participation" && state[s] === "granted") out.push({ scope: s, decision: "withdrawn" });
  }
  return { ok: true, history: out };
}

export interface ConsentFlags {
  consentResearch: boolean; consentAggregate: boolean; consentRecording: boolean; consentIdentifiableMedia: boolean; consentIdentifiableStory: boolean; withdrawn: boolean;
}
/** What analytics and publication may rely on. With no history every flag is false (deny by default). */
export function consentFlags(history: readonly ConsentEvent[]): ConsentFlags {
  const s = currentState(history);
  return {
    consentResearch: s.participation === "granted", consentAggregate: s.aggregate_use === "granted", consentRecording: s.recording === "granted",
    consentIdentifiableMedia: s.identifiable_media === "granted", consentIdentifiableStory: s.identifiable_story === "granted", withdrawn: s.participation === "withdrawn",
  };
}
