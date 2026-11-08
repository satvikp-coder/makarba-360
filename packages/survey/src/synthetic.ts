import type { Instrument } from "./index.js";

/**
 * SYNTHETIC test instrument. Placeholder wording only: it is NOT the research questionnaire, which needs the methodology decision (#4)
 * and institutional/bilingual review (#11) before any collection. Used to prove the rules, never shown to participants.
 */
export const SYNTHETIC_INSTRUMENT: Instrument = {
  code: "synthetic-v1",
  title: { en: "Synthetic test instrument" },
  questions: [
    { code: "C01", type: "yes_no", prompt: { en: "Synthetic: participant agrees to continue?" }, required: true, allowMissing: [] },
    {
      code: "R01", type: "single", prompt: { en: "Synthetic: role" }, required: true, showIf: { question: "C01", op: "eq", value: true },
      options: [{ value: "resident", label: { en: "Resident" } }, { value: "visitor", label: { en: "Visitor" } }, { value: "official", label: { en: "Official" } }, { value: "other", label: { en: "Other" } }],
    },
    {
      code: "R03", type: "yes_no", prompt: { en: "Synthetic: official claim?" }, required: false,
      showIf: { all: [{ question: "C01", op: "eq", value: true }, { question: "R01", op: "eq", value: "official" }] },
    },
    {
      code: "Q01", type: "multi", prompt: { en: "Synthetic: what is good here?" }, required: false, showIf: { question: "C01", op: "eq", value: true },
      options: [{ value: "heritage", label: { en: "Heritage" } }, { value: "access", label: { en: "Access" } }, { value: "none", label: { en: "Nothing" } }],
    },
    { code: "Q02", type: "integer_scale", prompt: { en: "Synthetic: condition 1-5" }, required: true, scale: { min: 1, max: 5 }, showIf: { question: "C01", op: "eq", value: true } },
    { code: "Q05", type: "text", prompt: { en: "Synthetic: improvement" }, required: false, maxLength: 200, showIf: { question: "Q02", op: "answered" } },
  ],
};
