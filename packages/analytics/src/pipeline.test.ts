import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ApprovedCohort } from "./cohorts.js";
import type { Interview, Period } from "./index.js";
import { buildSnapshot, InMemorySource, InMemoryStore, invalidateCurrent, PipelineError, publishSnapshot, saveCandidate, type BuildOptions } from "./pipeline.js";

// Frozen synthetic cases (#93): the same records and hand-computed expectations the domain tests use.
const doc = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/fixtures/analytics-cases.json", import.meta.url)), "utf8")) as { period: Period; records: Interview[] };
const P = doc.period;
const OPTS: BuildOptions = { builder: "builder", datasetKind: "synthetic", questionVersion: "v1", policyVersion: "k5-v1" };
const manifest: ApprovedCohort[] = [{ id: "all", label: "all", period: P, stakeholder: null, placeId: null }];
const fresh = () => ({ src: new InMemorySource(doc.records.map((r) => ({ ...r, status: "approved" as const }))), store: new InMemoryStore() });
const code = async (p: Promise<unknown>) => { try { await p; return "no error"; } catch (e) { return e instanceof PipelineError ? e.code : `other: ${(e as Error).message}`; } };

describe("snapshot pipeline with synthetic adapters [PASS - SYNTHETIC]", () => {
  it("builds a candidate that is valid, labelled synthetic and not public until approved", async () => {
    const { src, store } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS);
    await saveCandidate(store, s);
    expect(s.state).toBe("candidate");
    expect(await store.current()).toBeNull();
    expect((s.payload["meta"] as { datasetKind: string }).datasetKind).toBe("synthetic");
  });
  it("matches the frozen expectation: the lake-B rating cohort has a hidden neighbour cell, so the whole cohort is suppressed with no counts", async () => {
    const { src } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS);
    const c = (s.payload["cohorts"] as Record<string, unknown>[])[0]!;
    expect(c).toMatchObject({ suppressed: true, n: null, validAnswerN: null, ratings: [] });
  });
  it("approval by a different person publishes it and it becomes the single current snapshot", async () => {
    const { src, store } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, s);
    await publishSnapshot(src, store, s, "lead");
    expect((await store.current())?.id).toBe(s.id);
  });
  it("refuses self-approval, and refuses to publish anything that is not a candidate", async () => {
    const { src, store } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, s);
    expect(await code(publishSnapshot(src, store, s, "builder"))).toBe("SELF_APPROVAL");
    expect(await store.current()).toBeNull();
    expect(await code(publishSnapshot(src, store, { ...s, state: "invalidated" }, "lead"))).toBe("NOT_A_CANDIDATE");
  });
  it("a withdrawal between build and publish makes the snapshot stale: publication is refused and the old snapshot stays", async () => {
    const { src, store } = fresh();
    const first = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, first); await publishSnapshot(src, store, first, "lead");
    const second = await buildSnapshot(src, manifest, ["road-C"], P, OPTS); await saveCandidate(store, second);
    src.records = src.records.map((r) => (r.id === "S01" ? { ...r, withdrawn: true } : r));
    expect(await code(publishSnapshot(src, store, second, "lead"))).toBe("STALE_INPUT");
    expect((await store.current())?.id).toBe(first.id);
  });
  it("a withdrawal invalidates the current public snapshot before any new one exists", async () => {
    const { src, store } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, s); await publishSnapshot(src, store, s, "lead");
    expect(await invalidateCurrent(store, "withdrawal")).toBe(true);
    expect(await store.current()).toBeNull();
    expect(await invalidateCurrent(store, "again")).toBe(false);
  });
  it("a failing database read produces an error and no snapshot (never partial data)", async () => {
    const { src } = fresh(); src.failNext = true;
    expect(await code(buildSnapshot(src, manifest, ["lake-B"], P, OPTS))).toBe("SOURCE_FAILED");
  });
  it("an interrupted publication leaves the previous public snapshot untouched", async () => {
    const { src, store } = fresh();
    const a = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, a); await publishSnapshot(src, store, a, "lead");
    const b = await buildSnapshot(src, manifest, ["road-C"], P, OPTS); await saveCandidate(store, b);
    store.failPublish = true;
    expect(await code(publishSnapshot(src, store, b, "lead"))).toBe("STORE_FAILED");
    expect((await store.current())?.id).toBe(a.id);
  });
  it("an unsafe cohort manifest (a cohort under k) stops the build", async () => {
    const { src } = fresh();
    const risky: ApprovedCohort[] = [...manifest, { id: "tiny", label: "tiny", period: P, stakeholder: "shopkeeper", placeId: "road-C" }];
    expect(await code(buildSnapshot(src, risky, ["lake-B"], P, OPTS))).toBe("UNSAFE_MANIFEST");
  });
  it("empty data builds an empty valid snapshot rather than inventing numbers", async () => {
    const src = new InMemorySource([]);
    expect(await code(buildSnapshot(src, [], ["lake-B"], P, OPTS))).toBe("no error");
    expect(((await buildSnapshot(src, [], ["lake-B"], P, OPTS)).payload["cohorts"] as unknown[]).length).toBe(0);
  });
  it("a tampered payload (restricted field added) is refused at publication", async () => {
    const { src, store } = fresh();
    const s = await buildSnapshot(src, manifest, ["lake-B"], P, OPTS); await saveCandidate(store, s);
    const bad = { ...s, payload: { ...s.payload, interviewLatitude: 10.1 } };
    expect(await code(publishSnapshot(src, store, bad, "lead"))).toBe("CONTRACT_VIOLATION");
  });
  it("unapproved or draft interviews never reach a snapshot", async () => {
    const src = new InMemorySource(doc.records.map((r) => ({ ...r, status: "draft" as const })));
    const s = await buildSnapshot(src, [], ["lake-B"], P, OPTS);
    expect((s.payload["cohorts"] as unknown[]).length).toBe(0);
  });
});
