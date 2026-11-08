import type { ConsentDecision, ConsentRefusal, ConsentScope } from "./consent.js";

/** One case table, run through the pure rules AND the database trigger (parity). `script` false = the version is a draft. */
export interface ConsentCase {
  name: string;
  steps: { scope: ConsentScope; decision: ConsentDecision; script?: "approved" | "draft"; expect: "ok" | ConsentRefusal }[];
}
const g = (scope: ConsentScope, expect: "ok" | ConsentRefusal = "ok") => ({ scope, decision: "granted" as const, expect });
const r = (scope: ConsentScope, expect: "ok" | ConsentRefusal = "ok") => ({ scope, decision: "refused" as const, expect });
const w = (scope: ConsentScope, expect: "ok" | ConsentRefusal = "ok") => ({ scope, decision: "withdrawn" as const, expect });

export const CONSENT_CASES: ConsentCase[] = [
  { name: "scopes are independent: recording refused does not stop aggregate use or identifiable media", steps: [g("participation"), r("recording"), g("aggregate_use"), g("identifiable_media"), r("identifiable_story")] },
  { name: "nothing can be granted before participation", steps: [g("recording", "participation_required"), g("aggregate_use", "participation_required"), g("participation"), g("recording")] },
  { name: "refusing participation ends everything: no scope can be granted afterwards", steps: [r("participation"), g("participation", "overwrite_blocked"), g("aggregate_use", "participation_required")] },
  { name: "a refusal cannot be overwritten by a later grant (checkbox)", steps: [g("participation"), r("aggregate_use"), g("aggregate_use", "overwrite_blocked")] },
  { name: "a withdrawal cannot be overwritten by a later grant or a second withdrawal", steps: [g("participation"), g("recording"), w("recording"), g("recording", "overwrite_blocked"), w("recording", "overwrite_blocked")] },
  { name: "granting twice is refused, withdrawing something never granted is refused", steps: [g("participation"), g("recording"), g("recording", "already_granted"), w("aggregate_use", "nothing_to_withdraw"), w("identifiable_story", "nothing_to_withdraw")] },
  { name: "withdrawing participation withdraws every granted scope with it and blocks regrant", steps: [g("participation"), g("recording"), g("aggregate_use"), r("identifiable_media"), w("participation"), g("recording", "overwrite_blocked"), g("identifiable_story", "participation_required")] },
  { name: "withdrawing one optional scope leaves participation and the others intact", steps: [g("participation"), g("aggregate_use"), g("identifiable_story"), w("identifiable_story"), g("recording")] },
  { name: "a draft (unapproved) script cannot record a grant or a refusal", steps: [{ scope: "participation", decision: "granted", script: "draft", expect: "script_not_approved" }, { scope: "participation", decision: "refused", script: "draft", expect: "script_not_approved" }, g("participation")] },
  { name: "a withdrawal is accepted even if the script version was later retired", steps: [g("participation"), g("recording"), { scope: "recording", decision: "withdrawn", script: "draft", expect: "ok" }] },
];
