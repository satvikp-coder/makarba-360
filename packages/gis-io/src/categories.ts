/**
 * Location category taxonomy rules (issue #26). Pure functions mirrored by migration 0008's constraints, so a bad category is refused
 * both before it reaches the database and by the database itself. Synthetic categories only; real names are chosen by the research lead.
 */
export const CATEGORY_CODE = /^[a-z][a-z0-9_]{1,40}$/;
export const ICON_NAME = /^[a-z][a-z0-9-]{1,40}$/;
export const COLOR_TOKEN = /^[a-z][a-z0-9-]{1,30}$/;
export const FALLBACK_LOCALE = "en";

export interface Category {
  id: string;
  labels: Record<string, string>;
  icon: string;
  colorToken?: string | null;
  sortOrder?: number;
  description?: Record<string, string>;
  archived: boolean;
  replacedBy?: string | null;
}

export type CategoryIssue = {
  code: "bad_code" | "missing_fallback_label" | "empty_label" | "bad_locale" | "bad_icon" | "bad_color" | "duplicate_code" | "duplicate_icon" | "bad_replacement" | "archived_replacement" | "self_replacement";
  id: string;
  detail?: string;
};

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

/** Validates one proposed category list. Reports every problem; never repairs. Archived categories do not hold an icon. */
export function validateTaxonomy(list: readonly Category[]): CategoryIssue[] {
  const issues: CategoryIssue[] = [];
  const seen = new Map<string, Category>();
  const iconOwner = new Map<string, string>();
  for (const c of list) {
    if (!CATEGORY_CODE.test(c.id)) issues.push({ code: "bad_code", id: c.id });
    if (seen.has(c.id)) issues.push({ code: "duplicate_code", id: c.id });
    seen.set(c.id, c);
    const fallback = c.labels[FALLBACK_LOCALE];
    if (typeof fallback !== "string" || fallback.trim() === "") issues.push({ code: "missing_fallback_label", id: c.id });
    for (const [loc, text] of Object.entries(c.labels)) {
      if (!LOCALE.test(loc)) issues.push({ code: "bad_locale", id: c.id, detail: loc });
      else if (typeof text !== "string" || text.trim() === "") issues.push({ code: "empty_label", id: c.id, detail: loc });
    }
    if (!ICON_NAME.test(c.icon)) issues.push({ code: "bad_icon", id: c.id });
    if (c.colorToken != null && !COLOR_TOKEN.test(c.colorToken)) issues.push({ code: "bad_color", id: c.id });
    if (!c.archived) {
      const other = iconOwner.get(c.icon);
      if (other !== undefined) issues.push({ code: "duplicate_icon", id: c.id, detail: other });
      else iconOwner.set(c.icon, c.id);
    }
  }
  for (const c of list) {
    if (c.replacedBy == null) continue;
    if (c.replacedBy === c.id) issues.push({ code: "self_replacement", id: c.id });
    else if (!seen.has(c.replacedBy)) issues.push({ code: "bad_replacement", id: c.id, detail: c.replacedBy });
    else if (seen.get(c.replacedBy)!.archived) issues.push({ code: "archived_replacement", id: c.id, detail: c.replacedBy });
  }
  return issues;
}

/** Archive keeps the row: places that already reference it are untouched. New use is refused. */
export function archiveCategory(list: readonly Category[], id: string, replacedBy: string | null = null): Category[] {
  if (!list.some((c) => c.id === id)) throw new Error(`unknown category ${id}`);
  const next = list.map((c) => (c.id === id ? { ...c, archived: true, replacedBy } : c));
  const issues = validateTaxonomy(next);
  if (issues.length) throw new Error(`invalid archive: ${issues.map((i) => i.code).join(",")}`);
  return next;
}

export function canAssign(list: readonly Category[], id: string): boolean {
  const c = list.find((x) => x.id === id);
  return c !== undefined && !c.archived;
}

/** Display name in the requested locale, falling back to English, then to the stable code (never blank, never throws). */
export function labelFor(c: Pick<Category, "id" | "labels">, locale: string): string {
  const base = locale.split("-")[0] ?? locale;
  return c.labels[locale]?.trim() || c.labels[base]?.trim() || c.labels[FALLBACK_LOCALE]?.trim() || c.id;
}

/** Public read model: active categories in order, plus archived ones only if a published place still uses them. */
export function publicCategories(list: readonly Category[], usedBy: ReadonlySet<string>): Category[] {
  return list
    .filter((c) => !c.archived || usedBy.has(c.id))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
}
