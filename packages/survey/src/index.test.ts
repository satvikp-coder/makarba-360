import { describe, expect, it } from "vitest";
import { canonicalJson, validateAnswer, validateAnswers, validateInstrument, visibleQuestions, type Instrument, type Question } from "./index.js";
import { SYNTHETIC_INSTRUMENT as I } from "./synthetic.js";

const q = (code: string) => I.questions.find((x) => x.code === code) as Question;
const clone = (): Instrument => JSON.parse(JSON.stringify(I));

describe("instrument validation", () => {
  it("accepts the synthetic instrument", () => expect(validateInstrument(I)).toEqual([]));
  it("rejects duplicate codes, bad codes, missing prompts and unknown types", () => {
    const a = clone(); a.questions.push({ ...a.questions[0]! });
    expect(validateInstrument(a).join()).toMatch(/duplicate code C01/);
    const b = clone(); b.questions[0]!.code = "q1"; expect(validateInstrument(b).join()).toMatch(/code must look like/);
    const c = clone(); c.questions[1]!.prompt = { en: " " }; expect(validateInstrument(c).join()).toMatch(/prompt needs/);
    const d = clone(); (d.questions[0] as { type: string }).type = "slider"; expect(validateInstrument(d).join()).toMatch(/unknown type/);
  });
  it("rejects options problems, scales without bounds, and options on the wrong type", () => {
    const a = clone(); a.questions[1]!.options = [{ value: "a", label: { en: "A" } }]; expect(validateInstrument(a).join()).toMatch(/at least 2 options/);
    const b = clone(); b.questions[1]!.options![1]!.value = "resident"; expect(validateInstrument(b).join()).toMatch(/duplicate option/);
    const c = clone(); c.questions[4]!.scale = { min: 5, max: 1 }; expect(validateInstrument(c).join()).toMatch(/scale needs/);
    const d = clone(); d.questions[0]!.options = [{ value: "a", label: { en: "A" } }]; expect(validateInstrument(d).join()).toMatch(/only single and multi/);
  });
  it("branches may only look backwards: forward references and unknown questions are rejected", () => {
    const a = clone(); a.questions[0]!.showIf = { question: "Q02", op: "answered" }; expect(validateInstrument(a).join()).toMatch(/does not come earlier/);
    const b = clone(); b.questions[1]!.showIf = { question: "ZZZ", op: "answered" }; expect(validateInstrument(b).join()).toMatch(/does not come earlier/);
    const c = clone(); (c.questions[1]!.showIf as unknown) = { all: [] }; expect(validateInstrument(c).join()).toMatch(/empty/);
  });
  it("not_asked cannot be listed as an allowed choice, and garbage is rejected without throwing", () => {
    const a = clone(); (a.questions[0]!.allowMissing as string[]) = ["not_asked"]; expect(validateInstrument(a).join()).toMatch(/allowMissing/);
    for (const junk of [null, 1, "x", [], {}, { questions: "no" }]) expect(validateInstrument(junk).length).toBeGreaterThan(0);
  });
});

describe("answer validation", () => {
  it("accepts valid values for every question type", () => {
    expect(validateAnswer(q("C01"), { value: true })).toEqual([]);
    expect(validateAnswer(q("R01"), { value: "resident" })).toEqual([]);
    expect(validateAnswer(q("Q01"), { value: ["heritage", "access"] })).toEqual([]);
    expect(validateAnswer(q("Q02"), { value: 3 })).toEqual([]);
    expect(validateAnswer(q("Q05"), { value: "wider pavements" })).toEqual([]);
  });
  it("rejects wrong types, unknown options, duplicates, out-of-range and non-integer scale values, empty and over-long text", () => {
    expect(validateAnswer(q("C01"), { value: "yes" }).length).toBe(1);
    expect(validateAnswer(q("R01"), { value: "mayor" }).length).toBe(1);
    expect(validateAnswer(q("Q01"), { value: ["heritage", "heritage"] }).join()).toMatch(/duplicate/);
    expect(validateAnswer(q("Q01"), { value: [] }).length).toBe(1);
    for (const v of [0, 6, 2.5, "3", NaN, null]) expect(validateAnswer(q("Q02"), { value: v as number }).length, String(v)).toBe(1);
    expect(validateAnswer(q("Q05"), { value: "   " }).length).toBe(1);
    expect(validateAnswer(q("Q05"), { value: "x".repeat(201) }).join()).toMatch(/too long/);
  });
  it("unsure and refused are explicit missing reasons, never a number; not_asked is system-only; required cannot be skipped", () => {
    expect(validateAnswer(q("Q02"), { missing: "unsure" })).toEqual([]);
    expect(validateAnswer(q("Q02"), { missing: "refused" })).toEqual([]);
    expect(validateAnswer(q("Q02"), { value: 0 }).length).toBe(1);
    expect(validateAnswer(q("Q02"), { missing: "not_asked" }).join()).toMatch(/system/);
    expect(validateAnswer(q("Q02"), { missing: "skipped" }).join()).toMatch(/required/);
    expect(validateAnswer(q("Q05"), { missing: "skipped" })).toEqual([]);
    expect(validateAnswer(q("C01"), { missing: "refused" }).join()).toMatch(/not allowed/);
  });
  it("rejects malformed answer objects", () => {
    for (const a of [null, 5, "x", {}, { value: 1, missing: "unsure" }, { value: 1, extra: 1 }, { missing: "dunno" }]) expect(validateAnswer(q("Q02"), a).length, JSON.stringify(a)).toBeGreaterThan(0);
  });
});

describe("branching and whole-interview validation", () => {
  const consented = { C01: { value: true } };
  it("everything after consent is hidden until consent is yes", () => {
    expect(visibleQuestions(I, {}).map((x) => x.code)).toEqual(["C01"]);
    expect(visibleQuestions(I, { C01: { value: false } }).map((x) => x.code)).toEqual(["C01"]);
    expect(visibleQuestions(I, consented).map((x) => x.code)).toEqual(["C01", "R01", "Q01", "Q02"]);
  });
  it("the official-claim question appears only for officials; an unsure role does not trigger it", () => {
    expect(visibleQuestions(I, { ...consented, R01: { value: "official" } }).map((x) => x.code)).toContain("R03");
    expect(visibleQuestions(I, { ...consented, R01: { value: "resident" } }).map((x) => x.code)).not.toContain("R03");
    expect(visibleQuestions(I, { ...consented, R01: { missing: "unsure" } }).map((x) => x.code)).not.toContain("R03");
  });
  it("a complete valid interview passes; required questions must be answered or explicitly missing", () => {
    const ok = { ...consented, R01: { value: "visitor" }, Q02: { value: 4 } };
    expect(validateAnswers(I, ok)).toMatchObject({ ok: true, errors: [] });
    expect(validateAnswers(I, { ...consented, R01: { value: "visitor" } }).errors).toEqual(["Q02: required"]);
    expect(validateAnswers(I, { ...consented, R01: { missing: "refused" }, Q02: { missing: "unsure" } }).ok).toBe(true);
  });
  it("answers for hidden or unknown questions are refused (a refusal at consent leaves nothing behind)", () => {
    const e = validateAnswers(I, { C01: { value: false }, Q02: { value: 3 } }).errors.join();
    expect(e).toMatch(/Q02: this question is not shown/);
    expect(validateAnswers(I, { ...consented, Q99: { value: 1 } }).errors.join()).toMatch(/Q99: not a question in this version/);
    expect(validateAnswers(I, "nope").ok).toBe(false);
  });
  it("changing an earlier answer that hides a question invalidates the later answer instead of keeping it", () => {
    const answers = { ...consented, R01: { value: "official" }, R03: { value: true }, Q02: { value: 2 } };
    expect(validateAnswers(I, answers).ok).toBe(true);
    expect(validateAnswers(I, { ...answers, R01: { value: "resident" } }).errors.join()).toMatch(/R03: this question is not shown/);
  });
});

describe("canonical form", () => {
  it("is independent of key order and sensitive to every change", () => {
    const a = canonicalJson(I);
    const reordered = JSON.parse(JSON.stringify(I, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)));
    expect(canonicalJson(reordered)).toBe(a);
    const changed = clone(); changed.questions[4]!.scale = { min: 1, max: 6 };
    expect(canonicalJson(changed)).not.toBe(a);
    const wording = clone(); wording.questions[0]!.prompt = { en: "Synthetic: agrees?" };
    expect(canonicalJson(wording)).not.toBe(a);
  });
});
