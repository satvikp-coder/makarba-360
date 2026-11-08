import { findForbiddenField, validatePublic } from "@makarba/contracts";
import { expect } from "vitest";
import type { JourneyAdapter } from "./adapter.js";

type Snap = { cohorts: Record<string, unknown>[] };

/** The acceptance assertions for the field -> review -> public journey. Identical for every adapter. */
export async function runJourney(a: JourneyAdapter): Promise<void> {
  await a.reset();

  // Twelve consented interviews held at street-A about lake-B (5 fives, 5 fours, 1 unsure, 1 refused)
  const ids: string[] = [];
  const positions: { lat: number; lon: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const c = await a.capture({ seq: i, consent: "granted", heldAt: "street-A", discussed: ["lake-B"], rating: i < 5 ? 5 : 4, ...(i === 10 ? { reason: "unsure" as const } : i === 11 ? { reason: "refused" as const } : {}) });
    expect(c.savedAndReceived, `interview ${i} must be saved and received`).toBe(true);
    ids.push(c.id!);
    positions.push(c.privatePosition!);
  }

  // Consent refused: nothing is created and no position exists
  expect(await a.capture({ seq: 99, consent: "refused", heldAt: "street-A", discussed: ["lake-B"] })).toMatchObject({ id: null, privatePosition: null });

  // Review: people without review rights are refused; unreviewed records never reach the public
  for (const who of ["administrator", "researcher", "anonymous"] as const) expect(await a.approve(ids[0]!, who), who).toBe(false);
  await a.publish();
  expect(((await a.publicSnapshot("lake-B")) as Snap).cohorts, "nothing approved yet").toEqual([]);
  for (const id of ids) expect(await a.approve(id, "lead")).toBe(true);

  // Aggregation, disclosure and publication
  await a.publish();
  const lake = await a.publicSnapshot("lake-B");
  expect(validatePublic("insights", lake)).toEqual({ ok: true });
  expect((lake as Snap).cohorts[0]).toMatchObject({ suppressed: false, n: 12, validAnswerN: 10, unsureN: 1 });

  // The public result is safe and held-at / discussed places stay separate
  const text = JSON.stringify(lake);
  expect(findForbiddenField(JSON.parse(text))).toBeNull();
  expect(text).not.toMatch(/street-A|iv-\d|latitude|longitude|accuracy|researcher|participant/i);
  for (const p of positions) { expect(text).not.toContain(String(p.lat)); expect(text).not.toContain(String(p.lon)); }
  expect(((await a.publicSnapshot("street-A")) as Snap).cohorts).toEqual([]);

  // Withdrawal: removing the unsure person lowers n; removing a "5" leaves a cell under 5, so the group is suppressed with no counts
  await a.withdraw(ids[10]!);
  await a.publish();
  expect(((await a.publicSnapshot("lake-B")) as Snap).cohorts[0]).toMatchObject({ suppressed: false, n: 11 });
  await a.withdraw(ids[0]!);
  await a.publish();
  const after = (await a.publicSnapshot("lake-B")) as Snap;
  expect(after.cohorts[0]).toMatchObject({ suppressed: true, n: null, validAnswerN: null });
  expect(validatePublic("insights", after)).toEqual({ ok: true });
}
