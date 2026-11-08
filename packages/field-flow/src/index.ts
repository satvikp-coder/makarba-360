/**
 * Reference model of the researcher interview flow (F04 to F10; issue #20). A design prototype that fixes the rules the
 * field app must follow; it is NOT the field app and holds no real data. Developer A's implementation must conform to it.
 *
 * Rules encoded:
 *  - Consent is explicit; refusal ends the interview and discards participant content and GPS.
 *  - The interview position (where it was held) and the subject places (what is discussed) are different values and are
 *    never copied into one another.
 *  - GPS denial or poor accuracy is recorded as such, never replaced with an invented fix; a manual pin keeps the raw fix.
 *  - "Saved" is only reported after a durable write is acknowledged; "synced" only after the server receipt.
 */
export type Step = "consent" | "participant" | "position" | "subject" | "questions" | "media" | "review" | "saved" | "ended";
export const ORDER: Step[] = ["consent", "participant", "position", "subject", "questions", "media", "review", "saved"];

export type ConsentDecision = "unanswered" | "granted" | "refused";
export type GpsStatus = "not_asked" | "captured" | "denied" | "unavailable" | "manual";
export interface Position { status: GpsStatus; lat: number | null; lon: number | null; accuracyM: number | null; rawFix: { lat: number; lon: number; accuracyM: number } | null; manualReason: string | null }
export interface Answer { questionId: string; subjectId: string; value: string | null; reason: "answered" | "unsure" | "refused" | "not_asked" }
export type Sync = "none" | "local_only" | "durable" | "synced";

export interface State {
  step: Step;
  consent: { decision: ConsentDecision; scopes: string[]; scriptVersion: string | null; language: string | null };
  participant: { stakeholder: string | null } | null;
  position: Position;
  subjects: { id: string; label: string }[];
  answers: Answer[];
  save: Sync;
  online: boolean;
  errors: string[];
}

export const initial = (online = true): State => ({
  step: "consent", consent: { decision: "unanswered", scopes: [], scriptVersion: null, language: null }, participant: null,
  position: { status: "not_asked", lat: null, lon: null, accuracyM: null, rawFix: null, manualReason: null },
  subjects: [], answers: [], save: "none", online, errors: [],
});

export type Event =
  | { t: "consent"; decision: "granted" | "refused"; scopes?: string[]; scriptVersion: string; language: string }
  | { t: "participant"; stakeholder: string }
  | { t: "gps_result"; status: "captured"; lat: number; lon: number; accuracyM: number }
  | { t: "gps_result"; status: "denied" | "unavailable" }
  | { t: "manual_pin"; lat: number; lon: number; reason: string }
  | { t: "add_subject"; id: string; label: string }
  | { t: "remove_subject"; id: string }
  | { t: "answer"; answer: Answer }
  | { t: "next" } | { t: "back" }
  | { t: "durable_write_ok" } | { t: "durable_write_failed"; reason: string }
  | { t: "server_receipt" }
  | { t: "connectivity"; online: boolean };

export const POOR_ACCURACY_M = 50;
const inRange = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Blank every participant-derived value; used when consent is refused or withdrawn. */
function discard(s: State, decision: ConsentDecision): State {
  return { ...initial(s.online), step: "ended", consent: { ...s.consent, decision, scopes: [] } };
}

export function reduce(s: State, e: Event): State {
  if (e.t === "connectivity") return { ...s, online: e.online };      // never changes saved/synced claims
  if (s.step === "ended" || (s.step === "saved" && e.t !== "server_receipt")) return s;
  const err = (m: string): State => ({ ...s, errors: [m] });
  const ok = (p: Partial<State>): State => ({ ...s, errors: [], ...p });

  switch (e.t) {
    case "consent":
      if (s.step !== "consent") return err("Consent can only be recorded at the start.");
      if (e.decision === "refused") return discard(s, "refused");
      return ok({ consent: { decision: "granted", scopes: [...(e.scopes ?? [])], scriptVersion: e.scriptVersion, language: e.language } });
    case "participant":
      if (s.consent.decision !== "granted") return err("Consent is required first.");
      return ok({ participant: { stakeholder: e.stakeholder } });
    case "gps_result": {
      if (s.consent.decision !== "granted") return err("Consent is required first.");
      if (e.status !== "captured") return ok({ position: { ...s.position, status: e.status, lat: null, lon: null, accuracyM: null, rawFix: null } });
      if (!inRange(e.lat, e.lon) || !(e.accuracyM >= 0)) return err("The position reading is not valid. Try again or place a pin manually.");
      return ok({ position: { status: "captured", lat: e.lat, lon: e.lon, accuracyM: e.accuracyM, rawFix: { lat: e.lat, lon: e.lon, accuracyM: e.accuracyM }, manualReason: null } });
    }
    case "manual_pin":
      if (!e.reason.trim()) return err("A reason is required for a manual pin.");
      if (!inRange(e.lat, e.lon)) return err("The pin position is not valid.");
      // raw fix is kept; the manual position is labelled manual and carries no accuracy
      return ok({ position: { status: "manual", lat: e.lat, lon: e.lon, accuracyM: null, rawFix: s.position.rawFix, manualReason: e.reason.trim() } });
    case "add_subject":
      if (s.subjects.some((x) => x.id === e.id)) return err("That place is already added.");
      return ok({ subjects: [...s.subjects, { id: e.id, label: e.label }] });
    case "remove_subject":
      return ok({ subjects: s.subjects.filter((x) => x.id !== e.id), answers: s.answers.filter((a) => a.subjectId !== e.id) });
    case "answer": {
      if (!s.subjects.some((x) => x.id === e.answer.subjectId)) return err("Answers must belong to a selected place.");
      if (e.answer.reason === "answered" && (e.answer.value === null || e.answer.value === "")) return err("An answered question needs a value.");
      // missing is kept as missing with its reason, never as an empty string or zero
      const a: Answer = e.answer.reason === "answered" ? e.answer : { ...e.answer, value: null };
      return ok({ answers: [...s.answers.filter((x) => !(x.questionId === a.questionId && x.subjectId === a.subjectId)), a] });
    }
    case "next": return next(s);
    case "back": {
      const i = ORDER.indexOf(s.step);
      return i <= 0 ? s : ok({ step: ORDER[i - 1]! });
    }
    case "durable_write_ok":
      return s.step === "review" ? ok({ step: "saved", save: "durable" }) : s;
    case "durable_write_failed":
      return s.step === "review" ? err(`Not saved: ${e.reason}. Your answers are still on screen; do not close the app.`) : s;
    case "server_receipt":
      return s.save === "durable" ? ok({ save: "synced" }) : s;
  }
}

function next(s: State): State {
  const e = (m: string): State => ({ ...s, errors: [m] });
  switch (s.step) {
    case "consent": return s.consent.decision === "granted" ? { ...s, errors: [], step: "participant" } : e("Ask for consent and record the answer before continuing.");
    case "participant": return s.participant?.stakeholder ? { ...s, errors: [], step: "position" } : e("Choose a participant group.");
    case "position": return s.position.status === "not_asked" ? e("Capture the interview position, or record that it was denied or unavailable.") : { ...s, errors: [], step: "subject" };
    case "subject": return s.subjects.length ? { ...s, errors: [], step: "questions" } : e("Choose at least one place the interview is about.");
    case "questions": return { ...s, errors: [], step: "media" };
    case "media": return { ...s, errors: [], step: "review" };
    default: return s;
  }
}

/** What the review screen must show, kept apart. */
export function reviewSummary(s: State) {
  const poor = s.position.status === "captured" && (s.position.accuracyM ?? Infinity) > POOR_ACCURACY_M;
  return {
    interviewPosition: { label: "Where this interview was held (private)", status: s.position.status, accuracyM: s.position.accuracyM, poorAccuracy: poor, manualReason: s.position.manualReason },
    subjectPlaces: s.subjects.map((x) => ({ label: `Discussed: ${x.label}`, id: x.id })),
    answerCount: s.answers.length,
    missing: s.answers.filter((a) => a.reason !== "answered").length,
    consent: { decision: s.consent.decision, scopes: s.consent.scopes },
  };
}

/** Honest status line for the always-visible save indicator. */
export function statusLine(s: State): string {
  if (s.step === "ended") return "Interview ended. Nothing was kept.";
  if (s.save === "synced") return "Saved on this device and received by the server.";
  if (s.save === "durable") return s.online ? "Saved on this device. Not yet received by the server." : "Saved on this device. Offline: will send when connected.";
  return "Not saved yet.";
}

/** Withdrawal after consent was granted behaves like refusal: content and position are discarded locally. */
export function withdrawConsent(s: State): State { return s.step === "saved" ? s : discard(s, "refused"); }
