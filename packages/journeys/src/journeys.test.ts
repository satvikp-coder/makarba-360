import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canOpen } from "@makarba/admin-screens";
import { ratingGroupToCohort, ratingsAnalysis, locationSummary, stakeholderDistribution, type Interview } from "@makarba/analytics";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { findForbiddenField, validatePublic } from "@makarba/contracts";
import { initial, reduce, reviewSummary, type Event, type State } from "@makarba/field-flow";
import { describe, expect, it } from "vitest";

/**
 * Synthetic end-to-end journey (#113), composed from the real rule modules: field capture (field-flow) -> review (admin-screens +
 * authz) -> aggregation and disclosure (analytics) -> public contract validation (contracts). It is a COMPOSITION OF MODELS, not a run
 * against the live API, database or field app (those are Developer A's and do not exist yet); the adapter below is test code that
 * stands in for the real submission pipeline. All people, places and answers are invented; coordinates are around [10,10].
 */
const P = { from: "2026-01", through: "2026-03" };
const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));
const az = new Authorizer(loadMatrix());
const person = (userId: string, role: Principal["grants"][number]["role"], studyAreaId: string | null): Principal => ({ userId, active: true, trained: true, grants: [{ role, studyAreaId, expiresAt: null }] });
const lead = person("lead", "lead", "study-1"), admin = person("admin", "administrator", null), researcher = person("res", "researcher", "study-1"), otherLead = person("lead2", "lead", "study-2");
const STUDY = { studyAreaId: "study-1" };

/** Drives the real field-flow rules: held at `heldAt` (street-A, position captured), discussing `discussed` (lake-B). */
function interview(i: number, o: { consent?: "granted" | "refused"; rating?: number | null; reason?: "answered" | "unsure" | "refused" | "not_asked"; discussed?: string[]; gps?: "captured" | "denied" } = {}): { state: State; position: { lat: number; lon: number } | null } {
  const discussed = o.discussed ?? ["lake-B"];
  const pos = { lat: 10.1 + i / 10_000, lon: 10.2 + i / 10_000 };         // exact interview position: must never reach the public snapshot
  const events: Event[] = [{ t: "consent", decision: o.consent ?? "granted", scopes: ["research", "aggregate"], scriptVersion: "v1-synthetic", language: "en" }];
  if ((o.consent ?? "granted") === "granted") {
    events.push({ t: "next" }, { t: "participant", stakeholder: "resident" }, { t: "next" });
    events.push((o.gps ?? "captured") === "captured" ? { t: "gps_result", status: "captured", lat: pos.lat, lon: pos.lon, accuracyM: 8 } : { t: "gps_result", status: "denied" }, { t: "next" });
    for (const d of discussed) events.push({ t: "add_subject", id: d, label: d });
    events.push({ t: "next" });
    for (const d of discussed) events.push({ t: "answer", answer: { questionId: "overall", subjectId: d, value: o.reason && o.reason !== "answered" ? null : String(o.rating ?? 4), reason: o.reason ?? "answered" } });
    events.push({ t: "next" }, { t: "next" }, { t: "durable_write_ok" }, { t: "server_receipt" });
  }
  const state = events.reduce(reduce, initial());
  return { state, position: state.position.lat === null ? null : { lat: state.position.lat, lon: state.position.lon! } };
}

/** Test adapter standing in for the submission pipeline: a saved, synced field record becomes a pending interview. */
function submit(i: number, s: State, heldAt = "street-A"): Interview | null {
  if (s.step !== "saved" || s.save !== "synced") return null;                // nothing leaves the device before a durable, received save
  return {
    id: `iv-${i}`, status: "draft", currentRevision: true, consentResearch: s.consent.decision === "granted", consentAggregate: s.consent.scopes.includes("aggregate"), withdrawn: false,
    month: "2026-02", questionVersion: "v1", stakeholder: s.participant!.stakeholder, association: "1to5", interviewLocationId: heldAt,
    topics: s.answers.map((a) => ({ subjectId: a.subjectId, rating: a.value === null ? null : Number(a.value), ratingReason: a.reason, change: null, issuesSelected: null, issuesCoded: [] })),
  };
}
/** Review step: only someone allowed to open raw review for this study can approve. */
function review(by: Principal, rec: Interview): Interview {
  const gate = canOpen(az, by, "A04", STUDY);
  if (!gate.allow) throw new Error(`review refused: ${gate.reason}`);
  return { ...rec, status: "approved" };
}
const snapshot = (records: Interview[]) => {
  const g = ratingsAnalysis(records, "lake-B", P).groups;
  const cohorts = g.map((x) => ratingGroupToCohort("lake-B", x));
  return { ...bundle.insights, cohorts };
};
const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** 12 invented interviews: 10 rate lake-B 5 (five people) or 4 (five people), held at street-A, 1 unsure, 1 refused. */
const batch = () => Array.from({ length: 12 }, (_, i) => interview(i, i < 10 ? { rating: i < 5 ? 5 : 4 } : i === 10 ? { reason: "unsure" } : { reason: "refused" }));

describe("journey: capture at A about B -> review -> safe public snapshot", () => {
  const records = () => batch().map((b, i) => review(lead, submit(i, b.state)!));

  it("the interview held at street-A contributes to lake-B and not to street-A", () => {
    const rs = records();
    expect(ratingsAnalysis(rs, "lake-B", P).groups[0]).toMatchObject({ respondents: 12, validN: 10, unsureN: 1, refusedN: 1 });
    expect(ratingsAnalysis(rs, "street-A", P).groups).toEqual([]);
    expect(locationSummary(rs, "lake-B", P)).toMatchObject({ released: true, interviews: 12 });
    expect(locationSummary(rs, "street-A", P)).toMatchObject({ released: false, interviews: null });
  });

  it("the review screen shows the held-at position and the discussed place as two separate things", () => {
    const view = reviewSummary(interview(0).state);
    expect(view.interviewPosition.label).toMatch(/held \(private\)/);
    expect(view.subjectPlaces).toEqual([{ label: "Discussed: lake-B", id: "lake-B" }]);
  });

  it("the public snapshot is valid against the shared contract", () => {
    const snap = snapshot(records());
    expect(snap.cohorts).toHaveLength(1);
    expect(snap.cohorts[0]).toMatchObject({ suppressed: false, n: 12, validAnswerN: 10 });
    expect(validatePublic("insights", snap)).toEqual({ ok: true });
  });

  it("the public snapshot contains no exact interview position, no held-at place, no interview ids and no restricted field", () => {
    const text = JSON.stringify(snapshot(records()));
    expect(findForbiddenField(JSON.parse(text))).toBeNull();
    expect(text).not.toMatch(/street-A|iv-\d|10\.1\d{3}|10\.2\d{3}|latitude|longitude|accuracy|researcher|participant/i);
    for (const b of batch()) expect(text).not.toContain(String(b.position!.lat));
  });

  it("the whole journey is reproducible: same inputs give a byte-identical snapshot", () => {
    const [a, b] = [sha(snapshot(records())), sha(snapshot(records()))];
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("journey: consent, withdrawal and authorisation block intended exposure", () => {
  it("refused consent: the interview ends, nothing is saved, no position exists and nothing reaches the pipeline", () => {
    const r = interview(99, { consent: "refused" });
    expect(r.state.step).toBe("ended");
    expect(r.position).toBeNull();
    expect(submit(99, r.state)).toBeNull();
  });

  it("not yet saved and received on the device: nothing leaves it", () => {
    const base = interview(1).state;
    expect(submit(1, { ...base, save: "durable" })).toBeNull();      // saved locally but no receipt
    expect(submit(1, { ...base, step: "review", save: "none" })).toBeNull();
  });

  it("an unreviewed (draft) interview is not counted in any public figure", () => {
    const rs = batch().map((b, i) => submit(i, b.state)!);        // never approved
    expect(ratingsAnalysis(rs, "lake-B", P).groups).toEqual([]);
    expect(stakeholderDistribution(rs, P).released).toBe(false);
    expect(validatePublic("insights", snapshot(rs))).toEqual({ ok: true });
    expect(snapshot(rs).cohorts).toEqual([]);
  });

  it("a withdrawal after approval removes that person from the next snapshot; if the group falls under k it is suppressed, not shown", () => {
    const rs = batch().map((b, i) => review(lead, submit(i, b.state)!));
    const before = snapshot(rs).cohorts[0]!;
    expect(before).toMatchObject({ suppressed: false, n: 12 });
    const afterUnsure = snapshot(rs.map((r, i) => (i === 10 ? { ...r, withdrawn: true } : r))).cohorts[0]!;
    expect(afterUnsure).toMatchObject({ suppressed: false, n: 11, validAnswerN: 10, unsureN: 0 });
    // withdrawing one of the five "5" ratings leaves that cell at 4 (< 5), so the whole group is suppressed rather than show a derivable cell
    const afterFive = snapshot(rs.map((r, i) => (i === 0 ? { ...r, withdrawn: true } : r))).cohorts[0]!;
    expect(afterFive).toMatchObject({ suppressed: true, n: null });
    const mostWithdrawn = rs.map((r, i) => (i < 8 ? { ...r, withdrawn: true } : r));
    const small = snapshot(mostWithdrawn);
    expect(small.cohorts[0]).toMatchObject({ suppressed: true, n: null, validAnswerN: null });
    expect(JSON.stringify(small)).not.toMatch(/"count":\s*[0-9]/);       // no residual counts for the suppressed group
    expect(validatePublic("insights", small)).toEqual({ ok: true });
  });

  it("people without review rights cannot approve: technical admin, researcher, other study's lead, anonymous", () => {
    const rec = submit(0, interview(0).state)!;
    for (const who of [admin, researcher, otherLead]) expect(() => review(who, rec), who.userId).toThrow(/review refused/);
    expect(() => review(null as unknown as Principal, rec)).toThrow(/review refused/);
  });

  it("without consent to aggregate use the interview is kept out of public figures even when approved", () => {
    const b = interview(5).state;
    const rec = review(lead, { ...submit(5, b)!, consentAggregate: false });
    const others = batch().slice(0, 11).map((x, i) => review(lead, submit(i + 20, x.state)!));
    expect(ratingsAnalysis([rec, ...others], "lake-B", P).groups[0]!.respondents).toBe(11);
  });

  it("interviews that discuss several places are counted once overall and once per place", () => {
    const multi = Array.from({ length: 10 }, (_, i) => review(lead, submit(i + 40, interview(i + 40, { discussed: ["lake-B", "road-C"] }).state)!));
    expect(stakeholderDistribution(multi, P).analysed).toBe(10);
    expect(locationSummary(multi, "lake-B", P).interviews).toBe(10);
    expect(locationSummary(multi, "road-C", P).interviews).toBe(10);
    expect(locationSummary(multi, "lake-B", P).overlapNote).toMatch(/must not be added together/);
  });
});
