import { describe, expect, it } from "vitest";
import { applyConsent, consentFlags, currentState, type ConsentEvent } from "./consent.js";
import { CONSENT_CASES } from "./consent-cases.js";

describe("consent rules (pure)", () => {
  for (const c of CONSENT_CASES) {
    it(c.name, () => {
      let history: ConsentEvent[] = [];
      c.steps.forEach((s, i) => {
        const res = applyConsent(history, { scope: s.scope, decision: s.decision }, (s.script ?? "approved") === "approved");
        expect(res.ok ? "ok" : res.reason, `step ${i + 1}`).toBe(s.expect);
        if (res.ok) history = res.history;
      });
    });
  }
  it("flags: nothing recorded means nothing allowed; aggregate use needs its own grant; withdrawal flips everything", () => {
    expect(Object.values(consentFlags([])).some(Boolean)).toBe(false);
    let h: ConsentEvent[] = [];
    for (const e of [{ scope: "participation", decision: "granted" }, { scope: "recording", decision: "granted" }] as ConsentEvent[]) { const r = applyConsent(h, e, true); if (r.ok) h = r.history; }
    expect(consentFlags(h)).toMatchObject({ consentResearch: true, consentAggregate: false, consentRecording: true, withdrawn: false });
    const w = applyConsent(h, { scope: "participation", decision: "withdrawn" }, true);
    if (!w.ok) throw new Error("expected ok");
    expect(consentFlags(w.history)).toMatchObject({ consentResearch: false, consentRecording: false, withdrawn: true });
    expect(currentState(w.history).recording).toBe("withdrawn");
  });
  it("never mutates the history it is given", () => {
    const h: ConsentEvent[] = [{ scope: "participation", decision: "granted" }];
    const copy = JSON.stringify(h);
    applyConsent(h, { scope: "recording", decision: "granted" }, true);
    expect(JSON.stringify(h)).toBe(copy);
  });
});
