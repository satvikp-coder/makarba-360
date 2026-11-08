import { describe, expect, it } from "vitest";
import { SimulatedDevice, type SyncAdapter } from "./index.js";
import { SCENARIOS } from "./scenarios.js";

describe("offline scenarios against the synthetic simulator [PASS - SYNTHETIC]", () => {
  for (const s of SCENARIOS) it(`${s.id}: ${s.title}`, async () => { expect(await s.run(() => new SimulatedDevice())).toEqual([]); });
  it("the manifest has unique ids and covers every network, device and recovery condition listed for #62", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    const text = SCENARIOS.map((s) => s.title).join(" ").toLowerCase();
    for (const k of ["offline", "response lost", "timeout", "rejected", "session", "killed", "storage", "conflicting", "withdrawal", "media"]) expect(text, k).toContain(k);
  });
});

describe("the scenarios really detect a broken implementation", () => {
  /** A device that marks records synced as soon as they are queued (the classic false green badge). */
  class FalseGreen extends SimulatedDevice { override status(id: string) { return super.status(id) === "queued" ? "server_received" : super.status(id); } }
  /** A device that drops rejected records. */
  class Dropper extends SimulatedDevice { override async sync() { await super.sync(); if (this.pending()) (this as unknown as { queue: unknown[] }).queue.length = 0; } }
  /** A device that loses its queue on restart. */
  class Amnesiac extends SimulatedDevice { override restart() { super.restart(); (this as unknown as { queue: unknown[] }).queue = []; } }
  const fails = async (Impl: new () => SyncAdapter) => (await Promise.all(SCENARIOS.map(async (s) => ({ id: s.id, out: await s.run(() => new Impl()) })))).filter((r) => r.out.length).map((r) => r.id);
  it("a false 'synced' badge is caught", async () => { expect((await fails(FalseGreen)).length).toBeGreaterThan(0); });
  it("silently dropping a rejected or timed-out record is caught", async () => { expect(await fails(Dropper)).toEqual(expect.arrayContaining(["N04"])); });
  it("losing the queue on restart is caught", async () => { expect(await fails(Amnesiac)).toContain("N07"); });
});
