import { describe, expect, it } from "vitest";
import { initial, reduce, reviewSummary, statusLine, withdrawConsent, type Event, type State } from "./index.js";

const run = (s: State, ...es: Event[]) => es.reduce(reduce, s);
const granted = (s = initial()) => run(s, { t: "consent", decision: "granted", scopes: ["research"], scriptVersion: "v1-synthetic", language: "en" });
/** Walk a complete happy path up to the review screen. */
function toReview(): State {
  return run(granted(),
    { t: "next" }, { t: "participant", stakeholder: "resident" }, { t: "next" },
    { t: "gps_result", status: "captured", lat: 10, lon: 10, accuracyM: 12 }, { t: "next" },
    { t: "add_subject", id: "lake", label: "Synthetic Lake" }, { t: "next" },
    { t: "answer", answer: { questionId: "q1", subjectId: "lake", value: "3", reason: "answered" } }, { t: "next" }, { t: "next" });
}

describe("consent gate", () => {
  it("refusal ends the interview and discards everything, including any position", () => {
    const withGps = run(granted(), { t: "gps_result", status: "captured", lat: 10, lon: 10, accuracyM: 5 });
    expect(withGps.position.lat).toBe(10);
    const refused = reduce(initial(), { t: "consent", decision: "refused", scriptVersion: "v1", language: "en" });
    expect(refused.step).toBe("ended");
    expect(refused.position.lat).toBeNull();
    expect(refused.answers).toEqual([]);
    expect(statusLine(refused)).toBe("Interview ended. Nothing was kept.");
  });
  it("after refusal no further event can capture GPS, participant or answers", () => {
    const ended = reduce(initial(), { t: "consent", decision: "refused", scriptVersion: "v1", language: "en" });
    const after = run(ended, { t: "participant", stakeholder: "x" }, { t: "gps_result", status: "captured", lat: 1, lon: 1, accuracyM: 1 }, { t: "add_subject", id: "a", label: "A" }, { t: "next" });
    expect(after).toEqual(ended);
  });
  it("cannot capture GPS or participant data before consent is granted, and cannot skip the consent step", () => {
    expect(reduce(initial(), { t: "gps_result", status: "captured", lat: 1, lon: 1, accuracyM: 1 }).errors[0]).toMatch(/Consent is required/);
    expect(reduce(initial(), { t: "participant", stakeholder: "x" }).errors[0]).toMatch(/Consent is required/);
    expect(reduce(initial(), { t: "next" }).step).toBe("consent");
  });
  it("there is no default: unanswered consent does not allow continuing", () => { expect(initial().consent.decision).toBe("unanswered"); });
  it("withdrawal before the record is saved discards content; after saving it does not silently delete a saved record", () => {
    expect(withdrawConsent(toReview()).step).toBe("ended");
    const saved = run(toReview(), { t: "durable_write_ok" });
    expect(withdrawConsent(saved)).toBe(saved);
  });
});

describe("interview position and subject places stay separate", () => {
  it("subject selection never touches the position, and the position never becomes a subject", () => {
    const s = run(granted(), { t: "gps_result", status: "captured", lat: 10, lon: 10, accuracyM: 8 }, { t: "add_subject", id: "lake", label: "Synthetic Lake" });
    expect(s.position).toMatchObject({ lat: 10, lon: 10 });
    expect(s.subjects).toEqual([{ id: "lake", label: "Synthetic Lake" }]);
    const r = reviewSummary(s);
    expect(r.interviewPosition.label).toMatch(/held \(private\)/);
    expect(r.subjectPlaces[0]!.label).toBe("Discussed: Synthetic Lake");
  });
  it("cannot continue to questions without a subject place, even with a good GPS fix", () => {
    const s = run(granted(), { t: "next" }, { t: "participant", stakeholder: "r" }, { t: "next" }, { t: "gps_result", status: "captured", lat: 10, lon: 10, accuracyM: 5 }, { t: "next" }, { t: "next" });
    expect(s.step).toBe("subject");
    expect(s.errors[0]).toMatch(/at least one place/);
  });
  it("answers must belong to a chosen place; removing a place removes its answers", () => {
    const s = run(granted(), { t: "add_subject", id: "lake", label: "L" });
    expect(reduce(s, { t: "answer", answer: { questionId: "q", subjectId: "other", value: "1", reason: "answered" } }).errors[0]).toMatch(/selected place/);
    const withAns = run(s, { t: "answer", answer: { questionId: "q", subjectId: "lake", value: "1", reason: "answered" } });
    expect(run(withAns, { t: "remove_subject", id: "lake" }).answers).toEqual([]);
  });
  it("one answer per question per place; the same question for two places is kept separately (no duplication)", () => {
    const s = run(granted(), { t: "add_subject", id: "a", label: "A" }, { t: "add_subject", id: "b", label: "B" },
      { t: "answer", answer: { questionId: "q", subjectId: "a", value: "1", reason: "answered" } },
      { t: "answer", answer: { questionId: "q", subjectId: "b", value: "5", reason: "answered" } },
      { t: "answer", answer: { questionId: "q", subjectId: "a", value: "2", reason: "answered" } });
    expect(s.answers.map((x) => `${x.subjectId}:${x.value}`).sort()).toEqual(["a:2", "b:5"]);
  });
});

describe("GPS states", () => {
  const at = (...es: Event[]) => run(granted(), ...es);
  it("denied and unavailable are recorded as such with no invented coordinates, and the flow may continue", () => {
    for (const status of ["denied", "unavailable"] as const) {
      const s = at({ t: "gps_result", status });
      expect(s.position).toMatchObject({ status, lat: null, lon: null, accuracyM: null });
    }
    const s = run(granted(), { t: "next" }, { t: "participant", stakeholder: "r" }, { t: "next" }, { t: "gps_result", status: "denied" }, { t: "next" });
    expect(s.step).toBe("subject");
  });
  it("the position step cannot be skipped without an explicit outcome", () => {
    const s = run(granted(), { t: "next" }, { t: "participant", stakeholder: "r" }, { t: "next" }, { t: "next" });
    expect(s.step).toBe("position");
  });
  it("poor accuracy (above 50 m) is flagged on review; exactly 50 m is not", () => {
    expect(reviewSummary(at({ t: "gps_result", status: "captured", lat: 1, lon: 1, accuracyM: 51 })).interviewPosition.poorAccuracy).toBe(true);
    expect(reviewSummary(at({ t: "gps_result", status: "captured", lat: 1, lon: 1, accuracyM: 50 })).interviewPosition.poorAccuracy).toBe(false);
  });
  it("manual pin needs a reason, keeps the raw fix, and carries no invented accuracy", () => {
    const fixed = at({ t: "gps_result", status: "captured", lat: 10, lon: 10, accuracyM: 80 });
    expect(reduce(fixed, { t: "manual_pin", lat: 10.001, lon: 10, reason: "  " }).errors[0]).toMatch(/reason/);
    const m = reduce(fixed, { t: "manual_pin", lat: 10.001, lon: 10, reason: "Indoors, moved to door" });
    expect(m.position).toMatchObject({ status: "manual", lat: 10.001, accuracyM: null, manualReason: "Indoors, moved to door" });
    expect(m.position.rawFix).toEqual({ lat: 10, lon: 10, accuracyM: 80 });
  });
  it("invalid readings are rejected, not stored", () => {
    for (const e of [{ lat: 91, lon: 0, accuracyM: 5 }, { lat: 0, lon: 181, accuracyM: 5 }, { lat: NaN, lon: 0, accuracyM: 5 }, { lat: 0, lon: 0, accuracyM: -1 }, { lat: 0, lon: 0, accuracyM: NaN }]) {
      const s = at({ t: "gps_result", status: "captured", ...e });
      expect(s.errors[0]).toMatch(/not valid/);
      expect(s.position.status).toBe("not_asked");
    }
    expect(at({ t: "manual_pin", lat: 100, lon: 0, reason: "x" }).errors[0]).toMatch(/not valid/);
  });
});

describe("answers and missingness", () => {
  it("unsure and refused keep value null with the reason; they are never zero or empty text", () => {
    const s = run(granted(), { t: "add_subject", id: "a", label: "A" },
      { t: "answer", answer: { questionId: "q1", subjectId: "a", value: "0", reason: "unsure" } },
      { t: "answer", answer: { questionId: "q2", subjectId: "a", value: "", reason: "refused" } });
    expect(s.answers.every((a) => a.value === null)).toBe(true);
    expect(reviewSummary(s)).toMatchObject({ answerCount: 2, missing: 2 });
  });
  it("an answered question without a value is rejected", () => {
    const s = run(granted(), { t: "add_subject", id: "a", label: "A" });
    for (const value of [null, ""]) expect(reduce(s, { t: "answer", answer: { questionId: "q", subjectId: "a", value, reason: "answered" } }).errors[0]).toMatch(/needs a value/);
  });
});

describe("durable save and sync honesty", () => {
  it("nothing is reported saved before the durable write is acknowledged", () => {
    const r = toReview();
    expect(r.step).toBe("review");
    expect(statusLine(r)).toBe("Not saved yet.");
    expect(r.save).toBe("none");
  });
  it("a failed write keeps the user on review with the data intact and says not saved", () => {
    const r = reduce(toReview(), { t: "durable_write_failed", reason: "storage full" });
    expect(r.step).toBe("review");
    expect(r.errors[0]).toMatch(/Not saved: storage full/);
    expect(r.answers).toHaveLength(1);
    expect(statusLine(r)).toBe("Not saved yet.");
  });
  it("saved offline is 'saved on this device', never 'synced'; the receipt upgrades it", () => {
    const off = run(toReview(), { t: "connectivity", online: false }, { t: "durable_write_ok" });
    expect(off.save).toBe("durable");
    expect(statusLine(off)).toBe("Saved on this device. Offline: will send when connected.");
    const back = run(off, { t: "connectivity", online: true });
    expect(statusLine(back)).toBe("Saved on this device. Not yet received by the server.");
    expect(statusLine(reduce(back, { t: "server_receipt" }))).toBe("Saved on this device and received by the server.");
  });
  it("a server receipt before a durable save is ignored; connectivity changes never promote the state", () => {
    expect(reduce(toReview(), { t: "server_receipt" }).save).toBe("none");
    expect(run(toReview(), { t: "connectivity", online: true }).save).toBe("none");
  });
  it("a saved interview cannot be edited by further events", () => {
    const saved = run(toReview(), { t: "durable_write_ok" });
    expect(run(saved, { t: "add_subject", id: "x", label: "X" }, { t: "back" }, { t: "next" }).subjects).toHaveLength(1);
    expect(run(saved, { t: "back" }).step).toBe("saved");
  });
  it("going back keeps entered data", () => {
    const s = run(toReview(), { t: "back" }, { t: "back" });
    expect(s.step).toBe("questions");
    expect(s.answers).toHaveLength(1);
  });
});
