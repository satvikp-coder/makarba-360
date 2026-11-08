import { findForbiddenField, type Insights } from "@makarba/contracts";
import { csvCell } from "@makarba/gis-io";

/**
 * Standalone, DISABLED-BY-DEFAULT preparation for the stretch issues #128 to #135. Pure rules and data shapes with synthetic tests; no UI is
 * mounted and no route exists. Every feature is gated by `isEnabled`, which refuses to switch anything on in production until the release gate
 * (#126) is recorded as approved. Nothing here is a released feature, and none of it contains real Makarba content.
 */
export const FEATURES = ["tours", "corridorAudit", "audioArchive", "scenarios", "threeD", "hotspots", "reportExport"] as const;
export type Feature = (typeof FEATURES)[number];
export interface FeatureEnv { appEnv: "local" | "staging" | "production"; releaseApproved: boolean; enabled: Partial<Record<Feature, boolean>> }
export function isEnabled(f: Feature, env: FeatureEnv): boolean {
  if (!env.enabled[f]) return false;                                     // off unless explicitly switched on
  if (env.appEnv === "production" && !env.releaseApproved) return false;  // never in production before the release gate (#126)
  return true;
}

// ---------------------------------------------------------------- #128 guided tours
export interface TourStop { placeSlug: string; title: string; text: string }
export interface Tour { id: string; title: string; synthetic: boolean; stops: TourStop[] }
/** Only published places can be stops. Unpublished ones are dropped; a tour left with no stops is not shown. */
export function usableTour(t: Tour, published: ReadonlySet<string>): { tour: Tour; dropped: string[] } | null {
  const slugs = new Set<string>(); const stops: TourStop[] = []; const dropped: string[] = [];
  for (const s of t.stops) { if (!published.has(s.placeSlug) || slugs.has(s.placeSlug)) { dropped.push(s.placeSlug); continue; } slugs.add(s.placeSlug); stops.push(s); }
  return stops.length ? { tour: { ...t, stops }, dropped } : null;
}
export const stepTour = (i: number, n: number, key: "next" | "prev" | "first" | "last") => Math.max(0, Math.min(n - 1, key === "next" ? i + 1 : key === "prev" ? i - 1 : key === "first" ? 0 : n - 1));

// ---------------------------------------------------------------- #130 corridor audits
export type RubricValue = "meets" | "partly" | "does_not_meet" | "not_assessed";
export interface CorridorAudit { corridorId: string; rubricVersion: string; auditedOn: string | null; auditor: string | null; source: string | null; coverage: number; items: { id: string; value: RubricValue; evidence: string | null }[]; geometryVerified: boolean }
export function auditProblems(a: CorridorAudit): string[] {
  const p: string[] = [];
  if (!a.auditedOn || !a.auditor || !a.source) p.push("an audit needs a date, an auditor and a source");
  if (!(a.coverage >= 0 && a.coverage <= 1)) p.push("coverage must be between 0 and 1");
  if (!a.geometryVerified) p.push("the corridor geometry is not verified (see the geography register)");
  for (const i of a.items) if (i.value !== "not_assessed" && !i.evidence) p.push(`item ${i.id}: a judgement needs evidence`);
  return p;
}
/** The only wording allowed for accessibility: never a claim without a verified, evidenced audit; unknown stays unknown. */
export function accessibilityLabel(a: CorridorAudit | null, itemId: string): string {
  if (!a || auditProblems(a).length) return "Not assessed";
  const i = a.items.find((x) => x.id === itemId);
  if (!i || i.value === "not_assessed") return "Not assessed";
  return `${{ meets: "Meets the criterion", partly: "Partly meets the criterion", does_not_meet: "Does not meet the criterion" }[i.value]} (audited ${a.auditedOn}, ${Math.round(a.coverage * 100)}% of the corridor surveyed)`;
}

// ---------------------------------------------------------------- #131 audio archive
export interface AudioItem { id: string; consentAudioPublish: "granted" | "not_requested" | "withdrawn"; rightsCleared: boolean; withdrawn: boolean; transcript: string | null; attribution: "none" | "role" | "named"; role: string | null; name: string | null; durationSec: number }
export function audioBlockers(a: AudioItem): string[] {
  const p: string[] = [];
  if (a.consentAudioPublish !== "granted") p.push(`audio publication consent is "${a.consentAudioPublish}"`);
  if (a.withdrawn) p.push("withdrawn");
  if (!a.rightsCleared) p.push("rights not cleared");
  if (!a.transcript?.trim()) p.push("no transcript (needed for accessibility)");
  if (a.attribution === "named" && !a.name?.trim()) p.push("named attribution without a name");
  if (a.attribution === "role" && !a.role?.trim()) p.push("role attribution without a role");
  if (!(a.durationSec > 0)) p.push("invalid duration");
  return p;
}

// ---------------------------------------------------------------- #132 hypothetical scenarios
export interface Scenario { id: string; title: string; hypothetical: boolean; assumptions: string[]; basis: string | null; description: string }
export function scenarioProblems(s: Scenario): string[] {
  const p: string[] = [];
  if (s.hypothetical !== true) p.push("a scenario must be marked hypothetical");
  if (!s.assumptions.length) p.push("a scenario must state its assumptions");
  if (/\b(measured|observed|survey(ed)? found|residents (said|want)|will happen|is going to)\b/i.test(s.description)) p.push("wording presents the scenario as a measurement or a prediction");
  return p;
}
export const scenarioHeading = (s: Scenario) => `Hypothetical scenario (not observed or measured): ${s.title}`;

// ---------------------------------------------------------------- #133 3D evaluation
export interface Capabilities { webgl2: boolean; webgl: boolean; maxTexture: number; deviceMemoryGb: number | null; reducedMotion: boolean; saveData: boolean }
export function chooseRenderer(c: Capabilities): { mode: "3d" | "2d"; reason: string } {
  if (c.reducedMotion) return { mode: "2d", reason: "reduced motion requested" };
  if (c.saveData) return { mode: "2d", reason: "data saver is on" };
  if (!c.webgl2) return { mode: "2d", reason: c.webgl ? "WebGL 2 not available" : "WebGL not available" };
  if (c.maxTexture < 4096) return { mode: "2d", reason: "texture limit below 4096" };
  if (c.deviceMemoryGb !== null && c.deviceMemoryGb < 4) return { mode: "2d", reason: "less than 4 GB memory" };
  return { mode: "3d", reason: "capable device" };
}

// ---------------------------------------------------------------- #134 privacy-safe hotspots
export interface HotCell { cellId: string; bbox: [number, number, number, number]; count: number | null; suppressed: boolean }
export const MIN_CELL_DEGREES = 0.005;   // about 500 m: finer cells would approach individual positions
export function hotspotProblems(cells: HotCell[], k = 5): string[] {
  const p: string[] = [];
  if (findForbiddenField(cells) !== null) p.push("restricted field present");
  for (const c of cells) {
    const [w, s, e, n] = c.bbox;
    if (e - w < MIN_CELL_DEGREES || n - s < MIN_CELL_DEGREES) p.push(`${c.cellId}: cell is finer than ${MIN_CELL_DEGREES} degrees`);
    if (c.suppressed && c.count !== null) p.push(`${c.cellId}: a suppressed cell must not carry a count`);
    if (!c.suppressed && (c.count === null || c.count < k)) p.push(`${c.cellId}: a shown cell needs a count of at least ${k}`);
  }
  const hidden = cells.filter((c) => c.suppressed).length;
  if (hidden === 1 && cells.length > 1) p.push("exactly one hidden cell can be recovered from a published total: hide a neighbour too");
  return p;
}

// ---------------------------------------------------------------- #135 report export
export function reportCsv(snapshot: Insights): string {
  const meta = snapshot.meta;
  const rows: string[][] = [["Group", "People interviewed (n)", "Valid answers", "Unsure", "Missing", "Status"]];
  for (const c of snapshot.cohorts) rows.push(c.suppressed
    ? [c.cohortId, "hidden", "hidden", "hidden", "hidden", "Hidden to protect privacy (not zero)"]
    : [c.cohortId, String(c.n), String(c.validAnswerN), String(c.unsureN), String(c.missingN), "Shown"]);
  const banner = meta.datasetKind === "synthetic" ? "SYNTHETIC DEMONSTRATION DATA - NOT RESEARCH FINDINGS" : "Approved snapshot";
  const head = [`# ${banner}`, `# Snapshot ${meta.snapshotId}; collected ${snapshot.collectionPeriod.fromMonth} to ${snapshot.collectionPeriod.throughMonth}; questionnaire ${snapshot.questionVersion}; policy ${snapshot.policyVersion}`, `# ${snapshot.sampleNote}`];
  return [...head, ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n") + "\r\n";
}
