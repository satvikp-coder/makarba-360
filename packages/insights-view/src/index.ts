import { Cohort, Insights } from "@makarba/contracts";

/**
 * View model for public Community Insights (issues #19, #85-#91 UI side).
 * Guarantees: no-data, suppressed, missing, invalid and failed states are never rendered as zero,
 * and every chart caption carries n, period, missingness and the suppression/sample explanation.
 */
export type CohortView =
  | { kind: "invalid"; message: string }
  | { kind: "suppressed"; cohortId: string; explanation: string }
  | { kind: "ready"; cohortId: string; n: number; validN: number; missingN: number; unsureN: number; denominator: string; rule: string };

export type CellView =
  | { kind: "value"; text: string; count: number }
  | { kind: "none"; text: string }; // never "0"

const SUPPRESSION_TEXT = "Hidden to protect privacy: too few responses in this group. This is not zero, and the value cannot be derived from other figures.";

export function viewCohort(raw: unknown): CohortView {
  const p = Cohort.safeParse(raw);
  if (!p.success) return { kind: "invalid", message: "This result could not be validated and is not shown." };
  const c = p.data;
  if (c.suppressed) return { kind: "suppressed", cohortId: c.cohortId, explanation: SUPPRESSION_TEXT };
  return { kind: "ready", cohortId: c.cohortId, n: c.n!, validN: c.validAnswerN!, missingN: c.missingN!, unsureN: c.unsureN!, denominator: c.denominatorLabel!, rule: c.countingRule! };
}

/** A count cell. Absent, null or non-finite input is "No data", never 0; an explicit 0 from a ready cohort is shown as 0. */
export function viewCell(view: CohortView, count: number | null | undefined): CellView {
  if (view.kind === "suppressed") return { kind: "none", text: "Suppressed" };
  if (view.kind === "invalid") return { kind: "none", text: "Unavailable" };
  if (count === null || count === undefined || !Number.isInteger(count) || count < 0) return { kind: "none", text: "No data" };
  return { kind: "value", text: String(count), count };
}

export interface Caption { text: string; complete: true }

/** Mandatory chart/table caption. Throws if required context is unavailable so a chart cannot ship without it. */
export function captionFor(view: CohortView, period: { fromMonth: string; throughMonth: string }, sampleNote: string): Caption {
  if (!period.fromMonth || !period.throughMonth || !sampleNote.trim()) throw new Error("caption requires period and sample note");
  const when = `Collected ${period.fromMonth} to ${period.throughMonth}.`;
  if (view.kind === "suppressed") return { complete: true, text: `${view.explanation} ${when} ${sampleNote}` };
  if (view.kind === "invalid") return { complete: true, text: `${view.message} ${when}` };
  return { complete: true, text: `n = ${view.n} (valid answers ${view.validN}, missing ${view.missingN}, unsure ${view.unsureN}). ${view.denominator}; ${view.rule}. ${when} ${sampleNote}` };
}

/** Parses an Insights payload; any invalid cohort becomes an explicit "invalid" view rather than being dropped or zeroed. */
export function viewInsights(raw: unknown): { ok: false; message: string } | { ok: true; period: { fromMonth: string; throughMonth: string }; sampleNote: string; cohorts: CohortView[] } {
  const base = Insights.pick({ collectionPeriod: true, sampleNote: true }).passthrough().safeParse(raw);
  const cohorts = (raw as { cohorts?: unknown })?.cohorts;
  if (!base.success || !Array.isArray(cohorts)) return { ok: false, message: "Insights could not be loaded or validated." };
  return { ok: true, period: base.data.collectionPeriod, sampleNote: base.data.sampleNote, cohorts: cohorts.map(viewCohort) };
}
