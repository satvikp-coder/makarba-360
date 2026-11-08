/**
 * Questionnaire instrument and answer rules (issues #42, #43, groundwork for #51). Pure and browser-safe: no Node imports.
 * An instrument is data, versioned and immutable once published; answers are validated against the exact pinned version.
 * Content is NOT approved wording: the real questionnaire needs the methodology decision (#4) and institutional review (#11).
 */
export const MISSING_REASONS = ["not_asked", "skipped", "refused", "unsure", "not_applicable"] as const;
export type MissingReason = (typeof MISSING_REASONS)[number];
export const QUESTION_TYPES = ["single", "multi", "integer_scale", "text", "yes_no"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Condition =
  | { question: string; op: "eq"; value: string | number | boolean }
  | { question: string; op: "in"; value: (string | number)[] }
  | { question: string; op: "answered" }
  | { all: Condition[] }
  | { any: Condition[] };

export interface Option { value: string; label: Record<string, string> }
export interface Question {
  code: string;
  type: QuestionType;
  prompt: Record<string, string>;
  options?: Option[];
  scale?: { min: number; max: number };
  maxLength?: number;
  required: boolean;
  /** Which "missing" reasons the respondent may use instead of a value (not_asked is automatic for hidden questions). */
  allowMissing?: MissingReason[];
  showIf?: Condition;
}
export interface Instrument { code: string; title: Record<string, string>; questions: Question[] }

export type Answer = { value: string | number | boolean | string[] } | { missing: MissingReason };
export type Answers = Record<string, Answer>;

const CODE = /^[A-Z][A-Z0-9_]{1,23}$/;
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
export const MAX_TEXT = 2000;

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmptyLocaleMap = (m: unknown): m is Record<string, string> =>
  isRec(m) && typeof m["en"] === "string" && m["en"].trim() !== "" && Object.entries(m).every(([k, v]) => LOCALE.test(k) && typeof v === "string" && v.trim() !== "");

/** Problems with an instrument definition (empty means valid). Never repairs. */
export function validateInstrument(inst: unknown): string[] {
  const errs: string[] = [];
  if (!isRec(inst)) return ["instrument must be an object"];
  if (typeof inst["code"] !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(inst["code"])) errs.push("instrument code is required");
  if (!nonEmptyLocaleMap(inst["title"])) errs.push("instrument title needs a non-empty English text");
  const qs = inst["questions"];
  if (!Array.isArray(qs) || qs.length === 0) return [...errs, "instrument needs at least one question"];
  if (qs.length > 200) errs.push("more than 200 questions");
  const seen = new Set<string>();
  qs.forEach((q, i) => {
    const at = `question ${i + 1}`;
    if (!isRec(q)) { errs.push(`${at}: must be an object`); return; }
    const code = q["code"];
    if (typeof code !== "string" || !CODE.test(code)) errs.push(`${at}: code must look like Q01`);
    else if (seen.has(code)) errs.push(`${at}: duplicate code ${code}`);
    const name = typeof code === "string" ? code : at;
    if (!(QUESTION_TYPES as readonly unknown[]).includes(q["type"])) errs.push(`${name}: unknown type`);
    if (!nonEmptyLocaleMap(q["prompt"])) errs.push(`${name}: prompt needs a non-empty English text`);
    if (typeof q["required"] !== "boolean") errs.push(`${name}: required must be true or false`);
    const t = q["type"];
    if (t === "single" || t === "multi") {
      const opts = q["options"];
      if (!Array.isArray(opts) || opts.length < 2) errs.push(`${name}: needs at least 2 options`);
      else {
        const vals = new Set<string>();
        for (const o of opts) {
          if (!isRec(o) || typeof o["value"] !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(o["value"]) || !nonEmptyLocaleMap(o["label"])) { errs.push(`${name}: each option needs a value like heritage and an English label`); continue; }
          if (vals.has(o["value"])) errs.push(`${name}: duplicate option ${o["value"]}`);
          vals.add(o["value"]);
        }
      }
    } else if (q["options"] !== undefined) errs.push(`${name}: only single and multi questions have options`);
    if (t === "integer_scale") {
      const s = q["scale"];
      if (!isRec(s) || !Number.isInteger(s["min"]) || !Number.isInteger(s["max"]) || (s["min"] as number) >= (s["max"] as number) || (s["max"] as number) - (s["min"] as number) > 10) errs.push(`${name}: scale needs integer min < max (at most 11 steps)`);
    } else if (q["scale"] !== undefined) errs.push(`${name}: only integer_scale questions have a scale`);
    if (q["maxLength"] !== undefined && (t !== "text" || !Number.isInteger(q["maxLength"]) || (q["maxLength"] as number) < 1 || (q["maxLength"] as number) > MAX_TEXT)) errs.push(`${name}: maxLength only for text, 1..${MAX_TEXT}`);
    if (q["allowMissing"] !== undefined && (!Array.isArray(q["allowMissing"]) || q["allowMissing"].some((m) => !(MISSING_REASONS as readonly unknown[]).includes(m) || m === "not_asked"))) errs.push(`${name}: allowMissing may list skipped, refused, unsure, not_applicable`);
    if (typeof code === "string") {
      if (q["showIf"] !== undefined) errs.push(...conditionProblems(q["showIf"], seen, name));
      seen.add(code);
    }
  });
  return errs;
}

/** A condition may only look at questions that come earlier in the instrument (no cycles, no forward references). */
function conditionProblems(c: unknown, earlier: Set<string>, name: string, depth = 0): string[] {
  if (depth > 5 || !isRec(c)) return [`${name}: invalid showIf`];
  if (Array.isArray(c["all"]) || Array.isArray(c["any"])) {
    const list = (c["all"] ?? c["any"]) as unknown[];
    return list.length === 0 ? [`${name}: empty all/any`] : list.flatMap((x) => conditionProblems(x, earlier, name, depth + 1));
  }
  if (typeof c["question"] !== "string" || !earlier.has(c["question"])) return [`${name}: showIf refers to a question that does not come earlier`];
  if (c["op"] === "answered") return [];
  if (c["op"] === "eq") return ["string", "number", "boolean"].includes(typeof c["value"]) ? [] : [`${name}: showIf eq needs a value`];
  if (c["op"] === "in") return Array.isArray(c["value"]) && c["value"].length > 0 ? [] : [`${name}: showIf in needs a list`];
  return [`${name}: unknown showIf operator`];
}

function holds(c: Condition, answers: Answers): boolean {
  if ("all" in c) return c.all.every((x) => holds(x, answers));
  if ("any" in c) return c.any.some((x) => holds(x, answers));
  const a = answers[c.question];
  if (!a || !("value" in a)) return false;           // a missing answer never satisfies a condition (unsure is not a value)
  if (c.op === "answered") return true;
  if (c.op === "eq") return a.value === c.value;
  return !Array.isArray(a.value) && (c.value as (string | number | boolean)[]).includes(a.value as string | number);
}

/** Questions that should be asked given the answers so far, in instrument order. A hidden question is "not_asked". */
export function visibleQuestions(inst: Instrument, answers: Answers): Question[] {
  const out: Question[] = [];
  const effective: Answers = {};
  for (const q of inst.questions) {
    if (q.showIf && !holds(q.showIf, effective)) continue;
    out.push(q);
    const a = answers[q.code];
    if (a) effective[q.code] = a;
  }
  return out;
}

/** Problems with ONE answer against its question. */
export function validateAnswer(q: Question, a: unknown): string[] {
  if (!isRec(a)) return ["answer must be an object"];
  const keys = Object.keys(a);
  if (keys.length !== 1 || (keys[0] !== "value" && keys[0] !== "missing")) return ["answer must have exactly one of value or missing"];
  if ("missing" in a) {
    const m = a["missing"];
    if (!(MISSING_REASONS as readonly unknown[]).includes(m)) return ["unknown missing reason"];
    if (m === "not_asked") return ["not_asked is set by the system for hidden questions"];
    const allowed = q.allowMissing ?? ["skipped", "refused", "unsure", "not_applicable"];
    if (!(allowed as readonly unknown[]).includes(m)) return [`${q.code}: missing reason ${String(m)} is not allowed here`];
    if (m === "skipped" && q.required) return [`${q.code}: a required question cannot be skipped (use refused or unsure)`];
    return [];
  }
  const v = a["value"];
  switch (q.type) {
    case "yes_no": return typeof v === "boolean" ? [] : [`${q.code}: expected yes or no`];
    case "single": return typeof v === "string" && q.options!.some((o) => o.value === v) ? [] : [`${q.code}: not one of the options`];
    case "multi": {
      if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== "string")) return [`${q.code}: expected a non-empty list of options`];
      if (new Set(v).size !== v.length) return [`${q.code}: duplicate options`];
      return v.every((x) => q.options!.some((o) => o.value === x)) ? [] : [`${q.code}: not one of the options`];
    }
    case "integer_scale": return Number.isInteger(v) && (v as number) >= q.scale!.min && (v as number) <= q.scale!.max ? [] : [`${q.code}: expected a whole number from ${q.scale!.min} to ${q.scale!.max}`];
    case "text": {
      if (typeof v !== "string" || v.trim() === "") return [`${q.code}: text must not be empty (skip it instead)`];
      return v.length <= (q.maxLength ?? MAX_TEXT) ? [] : [`${q.code}: text is too long`];
    }
  }
}

/** Whole-interview check: hidden questions carry no answer, visible required ones are answered or explicitly missing, every answer is valid. */
export function validateAnswers(inst: Instrument, answers: unknown): { ok: boolean; errors: string[]; visible: string[] } {
  if (!isRec(answers)) return { ok: false, errors: ["answers must be an object"], visible: [] };
  const errors: string[] = [];
  const known = new Map(inst.questions.map((q) => [q.code, q]));
  for (const code of Object.keys(answers)) if (!known.has(code)) errors.push(`${code}: not a question in this version`);
  const visible = visibleQuestions(inst, answers as Answers);
  const shown = new Set(visible.map((q) => q.code));
  for (const code of Object.keys(answers)) if (known.has(code) && !shown.has(code)) errors.push(`${code}: this question is not shown for these answers`);
  for (const q of visible) {
    const a = answers[q.code];
    if (a === undefined) { if (q.required) errors.push(`${q.code}: required`); continue; }
    errors.push(...validateAnswer(q, a));
  }
  return { ok: errors.length === 0, errors, visible: visible.map((q) => q.code) };
}

/** Stable JSON (sorted keys, no whitespace) so the same instrument always yields the same bytes to hash. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (isRec(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export { SYNTHETIC_INSTRUMENT } from "./synthetic.js";
export * from "./position.js";
