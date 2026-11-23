/**
 * Past tab evidence model. Nothing is shown as history unless it carries a dated, https source and an uncertainty note;
 * proposed / sanctioned / implemented / observed / reconstructed are kept apart so a plan is never read as a built thing.
 */
export type Theme = "heritage" | "infrastructure" | "governance" | "ecology" | "population" | "planning";
export type Status = "documented" | "proposed" | "sanctioned" | "implemented" | "observed" | "reconstruction";
export type Precision = "exact" | "year" | "circa" | "range";
export type Tier = "primary" | "secondary" | "tertiary";
export type Confidence = "high" | "medium" | "low";

export interface Source { title: string; url: string; tier: Tier; accessed: string }
export interface PastEvent {
  id: string; theme: Theme; title: string; text: string;
  /** Start year (end year for ranges in `yearTo`). */
  year: number; yearTo?: number; precision: Precision; status: Status;
  source: Source; confidence: Confidence; uncertainty: string;
}
export interface Period { id: string; label: string; from: number; to: number; summary: string }
export interface TpScheme {
  id: string; name: string; areaHa?: number; status: string; statusDate?: string; source: Source;
  /** Boundaries are only drawn when a reviewed vector with a recorded CRS exists. */
  geometry: "unavailable" | "available"; note: string;
  /** The same scheme as described by another source. Differences are shown side by side, never merged or averaged. */
  alsoListed?: { source: Source; status: string; areaHa?: number; note?: string }[];
}
export interface ComparisonPoint { label: string; year: number; value: number; approx: boolean }
export interface Comparison {
  id: string; title: string; unit: string; points: ComparisonPoint[]; source: Source; method: string; limits: string;
}
export interface VisualRecord {
  id: string; src: string; alt: string; caption: string; year: number; precision: Precision; kind: "photograph" | "engraving" | "map";
  author: string; licence: string; commonsUrl: string;
}
export interface Gap { id: string; need: string; why: string; whoCanProvide: string }
export interface PastDoc {
  version: number; updated: string; periods: Period[]; events: PastEvent[]; tpSchemes: TpScheme[];
  comparisons: Comparison[]; visualRecord: VisualRecord[]; gaps: Gap[];
}

const HTTPS = /^https:\/\//;
const THEMES: readonly Theme[] = ["heritage", "infrastructure", "governance", "ecology", "population", "planning"];
const STATUSES: readonly Status[] = ["documented", "proposed", "sanctioned", "implemented", "observed", "reconstruction"];
const PRECISIONS: readonly Precision[] = ["exact", "year", "circa", "range"];

export const STATUS_LABEL: Record<Status, string> = {
  documented: "Documented", proposed: "Proposed (not built)", sanctioned: "Sanctioned plan", implemented: "Implemented",
  observed: "Observed", reconstruction: "Reconstruction (illustrative)",
};
export const THEME_LABEL: Record<Theme, string> = {
  heritage: "Heritage", infrastructure: "Roads & infrastructure", governance: "Governance", ecology: "Water & ecology",
  population: "People & settlement", planning: "Planning",
};

const validSource = (s: Source | undefined): s is Source => !!s && s.title.trim().length > 0 && HTTPS.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.accessed);

/** An event is shown only with a theme, status, plausible year, https source with access date, and an uncertainty note. */
export function validEvent(e: Partial<PastEvent> | null | undefined): e is PastEvent {
  if (!e || typeof e.id !== "string" || typeof e.title !== "string" || typeof e.text !== "string") return false;
  if (!THEMES.includes(e.theme as Theme) || !STATUSES.includes(e.status as Status)) return false;
  if (typeof e.year !== "number" || !Number.isInteger(e.year) || e.year < 1000 || e.year > 2100) return false;
  if (!PRECISIONS.includes(e.precision as Precision)) return false;
  if (e.yearTo !== undefined && (!Number.isInteger(e.yearTo) || e.yearTo < e.year)) return false;
  if (!validSource(e.source)) return false;
  return typeof e.uncertainty === "string" && e.uncertainty.trim().length > 0 && ["high", "medium", "low"].includes(e.confidence as string);
}

/** Events that pass validation, in chronological order. Invalid records are dropped, never repaired. */
export function usableEvents(doc: Pick<PastDoc, "events">): PastEvent[] {
  return doc.events.filter(validEvent).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

/** Events that had started by `year`. A proposal or sanctioned plan is returned with its own status, never as "implemented". */
export const eventsThrough = (events: PastEvent[], year: number): PastEvent[] => events.filter((e) => e.year <= year);

export const yearLabel = (e: Pick<PastEvent, "year" | "yearTo" | "precision">): string =>
  e.yearTo ? `${e.year}–${e.yearTo}` : e.precision === "circa" ? `c. ${e.year}` : String(e.year);

/** The period a year falls in, or null when the year is outside every documented period. */
export const periodOf = (periods: Period[], year: number): Period | null => periods.find((p) => year >= p.from && year <= p.to) ?? null;

export type ChartCheck = { ok: true; points: ComparisonPoint[] } | { ok: false; reason: string };
/** A comparison is charted only with two or more finite points in different years and a documented source and method. */
export function chartCheck(c: Comparison): ChartCheck {
  if (!validSource(c.source)) return { ok: false, reason: "No dated source is recorded for this measurement." };
  if (!c.unit.trim() || !c.method.trim()) return { ok: false, reason: "The unit or method is not documented, so values cannot be compared." };
  const pts = c.points.filter((p) => Number.isFinite(p.value) && Number.isInteger(p.year));
  if (new Set(pts.map((p) => p.year)).size < 2) return { ok: false, reason: "Only one dated measurement exists, so no change over time can be shown." };
  return { ok: true, points: [...pts].sort((a, b) => a.year - b.year) };
}

/** TP scheme geometry may only be drawn when it is marked available; everything else is listed with its record. */
export const schemeNeedsGeometry = (s: TpScheme): boolean => s.geometry !== "available";

export function validVisual(v: VisualRecord): boolean {
  return HTTPS.test(v.commonsUrl) && v.alt.trim().length > 0 && v.licence.trim().length > 0 && Number.isInteger(v.year);
}

export type PastResult = { status: "ok"; doc: PastDoc } | { status: "missing" } | { status: "error" };
export async function fetchPast(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<PastResult> {
  try {
    const r = await fetcher("/content/past.json", { signal });
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error" };
    const d = (await r.json()) as Partial<PastDoc>;
    if (!d || !Array.isArray(d.events) || !Array.isArray(d.periods)) return { status: "error" };
    return { status: "ok", doc: { version: d.version ?? 1, updated: d.updated ?? "", periods: d.periods, events: d.events, tpSchemes: d.tpSchemes ?? [], comparisons: d.comparisons ?? [], visualRecord: d.visualRecord ?? [], gaps: d.gaps ?? [] } };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { status: "error" };
    return { status: "error" };
  }
}
