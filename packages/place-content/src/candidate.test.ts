import { describe, expect, it } from "vitest";
import { approvalBlockers, approve, editCandidate, geometryDiff, insideBoundary, pointInRing, propose, publicView, publish, recordCheck, reject, requestChanges, type Candidate, type Ring } from "./candidate.js";

// Synthetic study boundary: a square around [10,10], not Makarba.
const BOUNDARY: Ring = [[9.9, 9.9], [10.1, 9.9], [10.1, 10.1], [9.9, 10.1], [9.9, 9.9]];
const inside = { type: "Point" as const, coordinates: [10, 10] as [number, number] };
const outsidePt = { type: "Point" as const, coordinates: [11, 11] as [number, number] };
const isErr = (x: unknown): x is { error: string } => typeof x === "object" && x !== null && "error" in x;
const must = <T,>(x: T | { error: string }): T => { if (isErr(x)) throw new Error(x.error); return x as T; };

/** Fully checked candidate: each check by a different reviewer than the approver. */
function reviewed(g = inside): Candidate {
  let c: Candidate = propose("c1", "alice", "Synthetic Lake", "community", g);
  for (const k of ["source", "name", "access", "boundary"] as const) c = must(recordCheck(c, k, "passed", `evidence for ${k}`, "rita", BOUNDARY));
  return c;
}

describe("geometry helpers", () => {
  it("point in ring includes the edge and excludes outside", () => {
    expect(pointInRing([10, 10], BOUNDARY)).toBe(true);
    expect(pointInRing([9.9, 10], BOUNDARY)).toBe(true);
    expect(pointInRing([10.2, 10], BOUNDARY)).toBe(false);
    expect(pointInRing([10, 9.89], BOUNDARY)).toBe(false);
  });
  it("a polygon partly outside reports how many vertices are outside", () => {
    const poly = { type: "Polygon" as const, coordinates: [[[10, 10], [10.2, 10], [10.2, 10.05], [10, 10]]] };
    expect(insideBoundary(poly, BOUNDARY)).toEqual({ inside: false, outsideVertices: 2 });
  });
});

describe("approval needs all four verified checks", () => {
  it("a fully checked candidate is approved by a different person", () => {
    const a = approve(reviewed(), "lead");
    expect("blocked" in a).toBe(false);
    expect((a as Candidate).state).toBe("approved");
  });
  it("each missing or failed check blocks approval with its own reason", () => {
    const p = propose("c", "alice", "X", "c", inside);
    expect(approvalBlockers(p, "lead")).toEqual(expect.arrayContaining(["state is \"candidate\"; checks have not been recorded", "source check not done", "name check not done", "access check not done", "boundary check not done"]));
    let c = reviewed();
    c = must(recordCheck(c, "access", "failed", "gate locked, no public access", "rita", BOUNDARY));
    expect(approvalBlockers(c, "lead")).toEqual(["access check failed"]);
  });
  it("evidence is mandatory for every check", () => {
    expect(isErr(recordCheck(propose("c", "a", "X", "c", inside), "source", "passed", "   ", "rita"))).toBe(true);
  });
  it("proposer cannot approve, and a checker cannot approve their own check", () => {
    expect(approvalBlockers(reviewed(), "alice")).toContain("approver must differ from the proposer");
    expect(approvalBlockers(reviewed(), "rita")).toEqual(expect.arrayContaining(["source check was made by the approver; another reviewer is needed"]));
  });
  it("editing the geometry clears the checks and bumps the revision", () => {
    const edited = must(editCandidate(reviewed(), { geometry: { type: "Point", coordinates: [10.01, 10] } }));
    expect(edited).toMatchObject({ revision: 2, state: "candidate" });
    expect(approvalBlockers(edited, "lead")).toContain("source check not done");
  });
  it("checks recorded on an old revision do not carry over", () => {
    const c = { ...reviewed(), revision: 2 };
    expect(approvalBlockers(c, "lead")).toContain("checks were made on an earlier revision");
  });
});

describe("boundary check is computed, not asserted", () => {
  it("a reviewer cannot pass the boundary check for an out-of-boundary geometry", () => {
    const r = recordCheck(propose("c", "alice", "X", "c", outsidePt), "boundary", "passed", "looks fine to me", "rita", BOUNDARY);
    expect(r).toEqual({ error: "1 vertex(es) lie outside the study boundary; the check cannot pass" });
  });
  it("it can be recorded as failed with evidence, and then approval is impossible", () => {
    const c = must(recordCheck(propose("c", "alice", "X", "c", outsidePt), "boundary", "failed", "1.4 degrees outside the study area", "rita", BOUNDARY));
    expect(c.checks.boundary.state).toBe("failed");
    expect("blocked" in approve(c, "lead")).toBe(true);
  });
  it("without a boundary supplied the check cannot be recorded", () => {
    expect(isErr(recordCheck(propose("c", "a", "X", "c", inside), "boundary", "passed", "ok", "rita"))).toBe(true);
  });
});

describe("rejected or out-of-boundary candidates stay private", () => {
  it("only a published candidate has a public view; every other state is null", () => {
    const base = reviewed();
    const approved = approve(base, "lead") as Candidate;
    const rejected = must(reject(base, "lead", "Name could not be verified"));
    const changes = must(requestChanges(base, "lead", "Need a better source"));
    for (const c of [propose("c", "a", "X", "c", inside), base, approved, rejected, changes]) expect(publicView(c, BOUNDARY)).toBeNull();
    const pub = must(publish(approved, "lead"));
    expect(publicView(pub, BOUNDARY)).toEqual({ id: "c1", name: "Synthetic Lake", category: "community", geometry: inside });
  });
  it("an out-of-boundary candidate stays null even if its state was forced to published (edge re-check)", () => {
    const forced: Candidate = { ...reviewed(), geometry: outsidePt, state: "published" }; // simulates corrupted/forced data
    expect(publicView(forced, BOUNDARY)).toBeNull();
  });
  it("only an approved candidate can be published", () => {
    expect(isErr(publish(reviewed(), "lead"))).toBe(true);
    expect(isErr(publish(must(reject(reviewed(), "lead", "No source")), "lead"))).toBe(true);
  });
  it("rejection and change requests need a reason; decided candidates cannot be re-checked or edited", () => {
    expect(isErr(reject(reviewed(), "lead", " "))).toBe(true);
    expect(isErr(requestChanges(reviewed(), "lead", ""))).toBe(true);
    const rej = must(reject(reviewed(), "lead", "Not a public place"));
    expect(rej).toMatchObject({ state: "rejected", decisionReason: "Not a public place" });
    expect(isErr(recordCheck(rej, "source", "passed", "x", "rita"))).toBe(true);
    expect(isErr(editCandidate(rej, { name: "Y" }))).toBe(true);
    expect(isErr(requestChanges(rej, "lead", "again"))).toBe(true);
  });
  it("a public projection never contains proposer, reviewer, evidence or reasons", () => {
    const pub = must(publish(approve(reviewed(), "lead") as Candidate, "lead"));
    expect(JSON.stringify(publicView(pub, BOUNDARY))).not.toMatch(/alice|rita|lead|evidence|checks|decision/);
  });
});

describe("geometry diff for the reviewer", () => {
  it("reports type change, vertex delta and movement without applying anything", () => {
    const a = { type: "Point" as const, coordinates: [10, 10] as [number, number] };
    expect(geometryDiff(a, a)).toEqual({ typeChanged: false, vertexDelta: 0, moved: false });
    expect(geometryDiff(a, { type: "Point", coordinates: [10.001, 10] })).toEqual({ typeChanged: false, vertexDelta: 0, moved: true });
    expect(geometryDiff(a, { type: "Polygon", coordinates: [[[10, 10], [10.1, 10], [10.1, 10.1], [10, 10]]] })).toEqual({ typeChanged: true, vertexDelta: 3, moved: true });
  });
});
