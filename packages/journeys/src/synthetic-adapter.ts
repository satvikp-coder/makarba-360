import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canOpen } from "@makarba/admin-screens";
import { ratingGroupToCohort, ratingsAnalysis, type Interview } from "@makarba/analytics";
import { Authorizer, loadMatrix, type Principal } from "@makarba/authz";
import { initial, reduce, type Event, type State } from "@makarba/field-flow";
import type { Actor, CaptureInput, Captured, JourneyAdapter } from "./adapter.js";

const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/project/contracts/fixture-bundle.json", import.meta.url)), "utf8"));
const az = new Authorizer(loadMatrix());
const mk = (userId: string, role: Principal["grants"][number]["role"], studyAreaId: string | null): Principal => ({ userId, active: true, trained: true, grants: [{ role, studyAreaId, expiresAt: null }] });
const WHO: Record<Actor, Principal | null> = { lead: mk("lead", "lead", "study-1"), administrator: mk("admin", "administrator", null), researcher: mk("res", "researcher", "study-1"), anonymous: null };
const PERIOD = { from: "2026-01", through: "2026-03" };

/** Composition of the real rule modules (field rules, authorizer, analytics, contract). No network. */
export class SyntheticAdapter implements JourneyAdapter {
  readonly mode = "synthetic" as const;
  private records = new Map<string, Interview>();
  private published: Interview[] = [];

  async reset() { this.records.clear(); this.published = []; }

  async capture(i: CaptureInput): Promise<Captured> {
    const pos = { lat: 10.1 + i.seq / 10_000, lon: 10.2 + i.seq / 10_000 };
    const ev: Event[] = [{ t: "consent", decision: i.consent, scopes: ["research", "aggregate"], scriptVersion: "v1-synthetic", language: "en" }];
    if (i.consent === "granted") {
      ev.push({ t: "next" }, { t: "participant", stakeholder: "resident" }, { t: "next" }, { t: "gps_result", status: "captured", lat: pos.lat, lon: pos.lon, accuracyM: 8 }, { t: "next" });
      for (const d of i.discussed) ev.push({ t: "add_subject", id: d, label: d });
      ev.push({ t: "next" });
      for (const d of i.discussed) ev.push({ t: "answer", answer: { questionId: "overall", subjectId: d, value: i.reason && i.reason !== "answered" ? null : String(i.rating ?? 4), reason: i.reason ?? "answered" } });
      ev.push({ t: "next" }, { t: "next" }, { t: "durable_write_ok" }, { t: "server_receipt" });
    }
    const s: State = ev.reduce(reduce, initial());
    if (s.step !== "saved" || s.save !== "synced") return { id: null, privatePosition: null, savedAndReceived: false };
    const id = `iv-${i.seq}`;
    this.records.set(id, {
      id, status: "draft", currentRevision: true, consentResearch: true, consentAggregate: s.consent.scopes.includes("aggregate"), withdrawn: false, month: "2026-02", questionVersion: "v1",
      stakeholder: "resident", association: "1to5", interviewLocationId: i.heldAt,
      topics: s.answers.map((a) => ({ subjectId: a.subjectId, rating: a.value === null ? null : Number(a.value), ratingReason: a.reason, change: null, issuesSelected: null, issuesCoded: [] })),
    });
    return { id, privatePosition: pos, savedAndReceived: true };
  }

  async approve(id: string, as: Actor) {
    const r = this.records.get(id);
    if (!r || !canOpen(az, WHO[as], "A04", { studyAreaId: "study-1" }).allow) return false;
    this.records.set(id, { ...r, status: "approved" });
    return true;
  }
  async withdraw(id: string) { const r = this.records.get(id); if (r) this.records.set(id, { ...r, withdrawn: true }); }
  async publish() { this.published = [...this.records.values()].map((r) => ({ ...r })); }
  async publicSnapshot(place: string) {
    const groups = ratingsAnalysis(this.published, place, PERIOD).groups;
    return { ...bundle.insights, cohorts: groups.map((g) => ratingGroupToCohort(place, g)) };
  }
}
