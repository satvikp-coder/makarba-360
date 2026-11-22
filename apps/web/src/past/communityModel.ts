/**
 * People and Place: past to present. Schema, validator and importer for APPROVED community recollections of change.
 * Pure TypeScript, browser-safe (no Node imports); the CLI in communityCli.ts and the page both use it.
 *
 * Nothing is published unless it carries a live, in-scope, unwithdrawn, unexpired consent record; contains no personal
 * identifier or precise coordinate; belongs to a theme AND a locality group of at least MIN_CELL_SIZE distinct consents.
 * Missing values stay explicit ({ missing: reason }, reasons from @makarba/survey); nothing is defaulted or guessed.
 * Policy: docs/research/community-evidence.md, docs/research/consent-protocol.md.
 */
import { findForbiddenField } from "@makarba/contracts";
import { MISSING_REASONS, type MissingReason } from "@makarba/survey";

/** Same provisional k5 threshold as the insights contract (packages/contracts: "cohort below provisional k5 threshold"). */
export const MIN_CELL_SIZE = 5;
/** Project choice pending institutional review: consent with no explicit expiry lapses this many months after it was given. */
export const CONSENT_MAX_MONTHS = 24;
export const MAX_TEXT = 600;
export const MIN_TEXT = 15;

export const COMMUNITY_THEMES = [
  "transport-access", "livelihoods", "community-public-space", "heritage-connection",
  "housing-urbanisation", "environment-water-green", "development-benefits", "development-costs",
] as const;
export type CommunityTheme = (typeof COMMUNITY_THEMES)[number];
export const COMMUNITY_THEME_LABEL: Record<CommunityTheme, string> = {
  "transport-access": "Transport and access", livelihoods: "Livelihoods and work", "community-public-space": "Community and public space",
  "heritage-connection": "Connection to heritage", "housing-urbanisation": "Housing and urbanisation", "environment-water-green": "Environment, water and green space",
  "development-benefits": "Benefits of development", "development-costs": "Costs of development",
};
export const PERSPECTIVES = ["positive", "negative", "mixed", "neutral"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];
export const SCOPES = ["public", "anonymised-summary", "withheld"] as const;
export type PublicationScope = (typeof SCOPES)[number];
export const METHODS = ["interview", "survey", "observation"] as const;
export type Method = (typeof METHODS)[number];
export const APPROVER_ROLES = ["principal-investigator", "institutional-reviewer", "data-steward"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export const TEXT_KINDS = ["excerpt", "paraphrase"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

export type Missing = { missing: MissingReason };
/** Years exactly as the participant stated them. */
export type Period = { kind: "period"; from: number; to: number } | { kind: "before-after"; beforeYear: number; afterYear: number };

export interface ConsentRecord {
  consentId: string; publicationScope: PublicationScope; withdrawn: boolean;
  /** ISO date (YYYY-MM-DD). */
  consentedOn: string; expiresOn?: string; approverRole: ApproverRole;
}
export interface Provenance { method: Method; collectedOn: string; locality: string | Missing }
/** What a researcher supplies (private). Never published as-is. */
export interface CommunityEntryInput {
  id: string; theme: CommunityTheme; period: Period | Missing; perspective: Perspective | Missing;
  text: string; textKind: TextKind; consent: ConsentRecord; provenance: Provenance;
}
/** What is published: no consent id, approver or exact dates. Locality is ward/neighbourhood level only. */
export interface PublishedEntry {
  id: string; theme: CommunityTheme; period: Period | Missing; perspective: Perspective | Missing;
  text: string; textKind: TextKind; scope: Exclude<PublicationScope, "withheld">;
  method: Method; collectedMonth: string; locality: string | Missing;
}
export interface CommunityDoc {
  version: 1; status: "no-approved-material" | "published"; updated: string | null; minCellSize: number; entries: PublishedEntry[];
}
export const EMPTY_COMMUNITY: CommunityDoc = { version: 1, status: "no-approved-material", updated: null, minCellSize: MIN_CELL_SIZE, entries: [] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
const CONSENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{5,39}$/;
const LOCALITY = /^[\p{L}][\p{L}\p{N} '.,&()-]{1,59}$/u;
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isMissing = (v: unknown): v is Missing => isRec(v) && Object.keys(v).length === 1 && (MISSING_REASONS as readonly string[]).includes(String(v["missing"]));
const validDate = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

/** Personal-identifier and precise-location patterns. The messages name the rule, never echo the matched text. */
const IDENTIFIER_RULES: { rule: string; re: RegExp }[] = [
  { rule: "an email address", re: /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/ },
  { rule: "a social handle", re: /(?:^|\s)@[A-Za-z0-9_]{3,}/ },
  { rule: "a web address", re: /\b(?:https?:\/\/|www\.)\S+/i },
  { rule: "a phone number", re: /\+\d[\d\s().-]{7,}\d|\b0?\d{5}[\s.-]?\d{5}\b|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10,}\b/ },
  { rule: "a precise coordinate", re: /-?\d{1,3}\.\d{3,}\s*[,;/ ]\s*-?\d{1,3}\.\d{3,}|\b\d{1,3}\.\d{4,}\b|\b\d{1,3}\s*°\s*\d{1,2}\s*[′']|\b(?:lat|lng|lon|latitude|longitude|coordinates?|gps)\b\s*[:=]?\s*-?\d/i },
  { rule: "a personal name", re: /\b(?:[Mm]y name is|[Ii] am called|[Ii]'m called|[Nn]ame:)\s+(?:(?:[Mm]r|[Mm]rs|[Mm]s|[Dd]r|[Ss]hri|[Ss]mt|[Ss]ri)\.?\s+)?[A-Z][a-z]+|\b(?:[Ss]on|[Dd]aughter|[Ww]ife|[Hh]usband|[Bb]rother|[Ss]ister|[Ff]ather|[Mm]other) of\s+[A-Z][a-z]+/ },
  { rule: "a titled personal name", re: /\b(?:Mr|Mrs|Ms|Miss|Dr|Shri|Smt|Sri|Shrimati|Bhai|Ben|Kaka|Uncle|Aunty)\.?\s+[A-Z][a-z]{2,}/ },
  { rule: "a house or flat address", re: /\b(?:flat|house|plot|door|room|bungalow|apartment)\s*(?:no\.?|number|#)?\s*[A-Za-z]?-?\d+/i },
  { rule: "a government or account number", re: /\b\d{4}\s?\d{4}\s?\d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b/ },
];
export const findIdentifier = (s: string): string | null => IDENTIFIER_RULES.find((r) => r.re.test(s))?.rule ?? null;

const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) - (Number(b.slice(8)) < Number(a.slice(8)) ? 1 : 0);
const normaliseText = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function strictKeys(o: Record<string, unknown>, allowed: string[], where: string, errs: string[]) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) errs.push(`${where}: unexpected field "${k}" (only the documented fields are accepted; names, contacts and coordinates are never accepted)`);
}

/** Validate one researcher-supplied entry. Returns every problem found; ok only when there are none. Never echoes entry text. */
export function validateEntry(raw: unknown, asOf: string): { ok: true; entry: CommunityEntryInput } | { ok: false; errors: string[] } {
  const errs: string[] = [];
  if (!isRec(raw)) return { ok: false, errors: ["entry is not an object"] };
  const forbidden = findForbiddenField(raw);
  if (forbidden) errs.push(`restricted private field ${forbidden}`);
  strictKeys(raw, ["id", "theme", "period", "perspective", "text", "textKind", "consent", "provenance"], "entry", errs);
  if (typeof raw["id"] !== "string" || !ID.test(raw["id"])) errs.push("id must be 3-40 letters, digits, hyphens or underscores");
  else if (findIdentifier(raw["id"])) errs.push("id contains an identifier-like value");
  if (!(COMMUNITY_THEMES as readonly string[]).includes(raw["theme"] as string)) errs.push(`unknown theme (allowed: ${COMMUNITY_THEMES.join(", ")})`);
  if (!(TEXT_KINDS as readonly string[]).includes(raw["textKind"] as string)) errs.push('textKind must be "excerpt" or "paraphrase"');

  const year = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 1900 && v <= Number(asOf.slice(0, 4));
  const p = raw["period"];
  if (p === undefined) errs.push('period is missing: supply the years the participant stated, or { "missing": "<reason>" }');
  else if (!isMissing(p)) {
    if (!isRec(p)) errs.push("period must be an object");
    else if (p["kind"] === "period") { strictKeys(p, ["kind", "from", "to"], "period", errs); if (!year(p["from"]) || !year(p["to"]) || (p["from"] as number) > (p["to"] as number)) errs.push("period needs integer years 1900..current with from <= to"); }
    else if (p["kind"] === "before-after") { strictKeys(p, ["kind", "beforeYear", "afterYear"], "period", errs); if (!year(p["beforeYear"]) || !year(p["afterYear"]) || (p["beforeYear"] as number) >= (p["afterYear"] as number)) errs.push("before/after needs integer years 1900..current with beforeYear < afterYear"); }
    else errs.push('period.kind must be "period" or "before-after"');
  }
  const ps = raw["perspective"];
  if (ps === undefined) errs.push('perspective is missing: supply a stance, or { "missing": "<reason>" }');
  else if (!isMissing(ps) && !(PERSPECTIVES as readonly string[]).includes(ps as string)) errs.push(`perspective must be one of ${PERSPECTIVES.join(", ")} or a missing-reason object`);

  const text = raw["text"];
  if (typeof text !== "string" || text.trim().length === 0) errs.push("text is missing");
  else {
    if (text.length > MAX_TEXT) errs.push(`text is too long (${text.length} characters; the limit is ${MAX_TEXT}): publish a short excerpt or a paraphrase`);
    if (text.trim().length < MIN_TEXT) errs.push(`text is too short to be meaningful (minimum ${MIN_TEXT} characters)`);
    const hit = findIdentifier(text);
    if (hit) errs.push(`text contains ${hit}: remove it or paraphrase`);
  }

  const c = raw["consent"];
  let scope: unknown;
  if (!isRec(c)) errs.push("consent record is missing: nothing is published without consent");
  else {
    strictKeys(c, ["consentId", "publicationScope", "withdrawn", "consentedOn", "expiresOn", "approverRole"], "consent", errs);
    if (typeof c["consentId"] !== "string" || !CONSENT_ID.test(c["consentId"])) errs.push("consent.consentId must be a 6-40 character random receipt reference");
    else if (findIdentifier(c["consentId"])) errs.push("consent.consentId looks like an identifier");
    scope = c["publicationScope"];
    if (!(SCOPES as readonly string[]).includes(scope as string)) errs.push(`consent.publicationScope must be one of ${SCOPES.join(", ")}`);
    else if (scope === "withheld") errs.push("consent scope is withheld: the participant did not agree to publication");
    if (typeof c["withdrawn"] !== "boolean") errs.push("consent.withdrawn must be true or false (never assumed)");
    else if (c["withdrawn"]) errs.push("consent has been withdrawn");
    if (!validDate(c["consentedOn"])) errs.push("consent.consentedOn must be a real date (YYYY-MM-DD)");
    else {
      if (c["consentedOn"] > asOf) errs.push("consent.consentedOn is in the future");
      else if (c["expiresOn"] === undefined && monthsBetween(c["consentedOn"], asOf) >= CONSENT_MAX_MONTHS) errs.push(`consent has expired: given more than ${CONSENT_MAX_MONTHS} months ago with no renewal`);
    }
    if (c["expiresOn"] !== undefined) { if (!validDate(c["expiresOn"])) errs.push("consent.expiresOn must be a real date (YYYY-MM-DD)"); else if (c["expiresOn"] <= asOf) errs.push("consent has expired"); }
    if (!(APPROVER_ROLES as readonly string[]).includes(c["approverRole"] as string)) errs.push(`consent.approverRole must be one of ${APPROVER_ROLES.join(", ")}`);
  }
  if (scope === "anonymised-summary" && raw["textKind"] !== "paraphrase") errs.push("scope anonymised-summary allows a researcher paraphrase only, not a verbatim excerpt");

  const pv = raw["provenance"];
  if (!isRec(pv)) errs.push("provenance is missing");
  else {
    strictKeys(pv, ["method", "collectedOn", "locality"], "provenance", errs);
    if (!(METHODS as readonly string[]).includes(pv["method"] as string)) errs.push(`provenance.method must be one of ${METHODS.join(", ")}`);
    if (!validDate(pv["collectedOn"])) errs.push("provenance.collectedOn must be a real date (YYYY-MM-DD)");
    else if (pv["collectedOn"] > asOf) errs.push("provenance.collectedOn is in the future");
    const l = pv["locality"];
    if (l === undefined) errs.push('provenance.locality is missing: supply a ward or neighbourhood name, or { "missing": "<reason>" }');
    else if (!isMissing(l)) {
      if (typeof l !== "string" || !LOCALITY.test(l)) errs.push("provenance.locality must be a ward or neighbourhood name (2-60 characters)");
      else { const hit = findIdentifier(l); if (hit) errs.push(`provenance.locality contains ${hit}: ward or neighbourhood level only`); }
    }
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true, entry: raw as unknown as CommunityEntryInput };
}

export interface ImportReport {
  doc: CommunityDoc;
  rejected: { index: number; id: string | null; errors: string[] }[];
  /** Valid entries held back because their theme or locality group had fewer than MIN_CELL_SIZE distinct consents. Only a total is reported. */
  suppressed: number;
  accepted: number;
}

export interface ImportOptions { asOf: string; minCellSize?: number }
const localityKey = (l: string | Missing) => (typeof l === "string" ? `l:${l.trim().toLowerCase()}` : "l:(not recorded)");

/** Validate a researcher file, drop what cannot be published, suppress small cells, and return the publishable document. */
export function importCommunity(raw: unknown, opts: ImportOptions): ImportReport {
  const min = opts.minCellSize ?? MIN_CELL_SIZE;
  const list = Array.isArray(raw) ? raw : isRec(raw) && Array.isArray(raw["entries"]) ? raw["entries"] : null;
  if (!list) return { doc: EMPTY_COMMUNITY, rejected: [{ index: -1, id: null, errors: ['file must be an array of entries or { "entries": [...] }'] }], suppressed: 0, accepted: 0 };
  const rejected: ImportReport["rejected"] = [];
  const valid: CommunityEntryInput[] = [];
  const ids = new Set<string>(); const texts = new Set<string>();
  list.forEach((r, index) => {
    const v = validateEntry(r, opts.asOf);
    const id = isRec(r) && typeof r["id"] === "string" && ID.test(r["id"]) ? r["id"] : null;
    if (!v.ok) return void rejected.push({ index, id, errors: v.errors });
    const t = normaliseText(v.entry.text);
    if (ids.has(v.entry.id)) return void rejected.push({ index, id, errors: ["duplicate id"] });
    if (texts.has(t)) return void rejected.push({ index, id, errors: ["duplicate text (the same recollection appears twice)"] });
    ids.add(v.entry.id); texts.add(t); valid.push(v.entry);
  });
  // Small-cell suppression: a group counts DISTINCT consents (one person must not fill a cell). Dropping an entry can shrink another group, so repeat until stable.
  let kept = valid;
  for (;;) {
    const groups = (key: (e: CommunityEntryInput) => string) => { const m = new Map<string, Set<string>>(); for (const e of kept) { const k = key(e); (m.get(k) ?? m.set(k, new Set()).get(k)!).add(e.consent.consentId); } return m; };
    const th = groups((e) => `t:${e.theme}`); const lo = groups((e) => localityKey(e.provenance.locality));
    const next = kept.filter((e) => (th.get(`t:${e.theme}`)?.size ?? 0) >= min && (lo.get(localityKey(e.provenance.locality))?.size ?? 0) >= min);
    if (next.length === kept.length) break;
    kept = next;
  }
  const entries: PublishedEntry[] = kept.map((e) => ({
    id: e.id, theme: e.theme, period: e.period, perspective: e.perspective, text: e.text.trim(), textKind: e.textKind,
    scope: e.consent.publicationScope as PublishedEntry["scope"], method: e.provenance.method,
    collectedMonth: e.provenance.collectedOn.slice(0, 7), locality: typeof e.provenance.locality === "string" ? e.provenance.locality.trim() : e.provenance.locality,
  }));
  const doc: CommunityDoc = entries.length
    ? { version: 1, status: "published", updated: opts.asOf, minCellSize: min, entries }
    : { ...EMPTY_COMMUNITY, minCellSize: min };
  return { doc, rejected, suppressed: valid.length - kept.length, accepted: valid.length };
}

/** Re-check a published document in the browser (and in tests): defence in depth against a hand-edited or stale file. */
export function parsePublished(raw: unknown): CommunityDoc | null {
  if (!isRec(raw) || raw["version"] !== 1 || !Array.isArray(raw["entries"])) return null;
  if (raw["status"] !== "no-approved-material" && raw["status"] !== "published") return null;
  if (findForbiddenField(raw)) return null;
  const min = raw["minCellSize"];
  if (typeof min !== "number" || min < MIN_CELL_SIZE) return null;
  if (raw["status"] === "no-approved-material") return raw["entries"].length === 0 ? { ...EMPTY_COMMUNITY } : null;
  if (raw["entries"].length === 0 || typeof raw["updated"] !== "string") return null;
  const asOf = raw["updated"];
  const out: PublishedEntry[] = [];
  const keys = ["id", "theme", "period", "perspective", "text", "textKind", "scope", "method", "collectedMonth", "locality"];
  for (const e of raw["entries"]) {
    if (!isRec(e) || Object.keys(e).some((k) => !keys.includes(k)) || !keys.every((k) => k in e)) return null;
    if (e["scope"] !== "public" && e["scope"] !== "anonymised-summary") return null;
    if (typeof e["collectedMonth"] !== "string" || !/^\d{4}-\d{2}$/.test(e["collectedMonth"])) return null;
    // Reuse the import validator on a synthetic consent so the same text, period, theme and locality rules apply to what ships.
    const v = validateEntry({
      id: e["id"], theme: e["theme"], period: e["period"], perspective: e["perspective"], text: e["text"], textKind: e["textKind"],
      consent: { consentId: "published-check", publicationScope: e["scope"], withdrawn: false, consentedOn: asOf, approverRole: "data-steward" },
      provenance: { method: e["method"], collectedOn: `${e["collectedMonth"]}-01`, locality: e["locality"] },
    }, asOf);
    if (!v.ok) return null;
    out.push(e as unknown as PublishedEntry);
  }
  const counts = new Map<string, number>();
  for (const e of out) counts.set(e.theme, (counts.get(e.theme) ?? 0) + 1);
  if ([...counts.values()].some((n) => n < min)) return null;
  return { version: 1, status: "published", updated: asOf, minCellSize: min, entries: out };
}

export type CommunityResult = { status: "ok"; doc: CommunityDoc } | { status: "missing" } | { status: "error" };
export async function fetchCommunity(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<CommunityResult> {
  try {
    const r = await fetcher("/content/community.json", { signal, cache: "no-store" });
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error" };
    const doc = parsePublished(await r.json());
    return doc ? { status: "ok", doc } : { status: "error" };
  } catch { return { status: "error" }; }
}

export const periodLabel = (p: Period | Missing): string =>
  "missing" in p ? "Years not stated" : p.kind === "period" ? (p.from === p.to ? `${p.from}` : `${p.from} to ${p.to}`) : `Before ${p.beforeYear}, after ${p.afterYear}`;
export const SCOPE_LABEL: Record<PublishedEntry["scope"], string> = { public: "Shared with permission as a short excerpt or paraphrase", "anonymised-summary": "Anonymised researcher summary (not a quotation)" };
export const PERSPECTIVE_LABEL: Record<Perspective, string> = { positive: "Positive", negative: "Negative", mixed: "Mixed", neutral: "Neutral" };
export const METHOD_LABEL: Record<Method, string> = { interview: "Interview", survey: "Survey", observation: "Researcher observation" };
