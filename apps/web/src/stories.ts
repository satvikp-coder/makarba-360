import { findForbiddenField } from "@makarba/contracts";
import { API_BASE } from "./api.js";
import { apiFetch } from "./http.js";

/**
 * PROPOSED public contract for approved stories (issue #80). It mirrors `toPublicStory` in packages/place-content: three block kinds with
 * fixed public labels, attribution already resolved to the permitted text (or absent), no author, reviewer, consent or evidence data.
 * Until Developer A and Developer B adopt it into the shared contracts, the web app validates it locally and strictly: anything that
 * does not match exactly is refused, not displayed.
 */
export type PublicBlock =
  | { label: "Verified fact"; text: string }
  | { label: "What a person remembers"; quote: string; period: string | null; attribution: string | null }
  | { label: "Official statement"; text: string; body: string; statementDate: string; scope: string };
export interface PublicStory { id: string; locationId: string; slug: string; title: string; blocks: PublicBlock[] }
export interface StoriesData { stories: PublicStory[]; synthetic: boolean }
export type StoriesResult = { status: "ok"; data: StoriesData } | { status: "missing" } | { status: "error"; retryable: boolean };

const exactKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).length === keys.length && keys.every((k) => k in o);
const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 4000;
const strOrNull = (v: unknown): v is string | null => v === null || str(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseBlock(b: unknown): PublicBlock | null {
  if (!obj(b)) return null;
  if (b["label"] === "Verified fact" && exactKeys(b, ["label", "text"]) && str(b["text"])) return { label: "Verified fact", text: b["text"] };
  if (b["label"] === "What a person remembers" && exactKeys(b, ["label", "quote", "period", "attribution"]) && str(b["quote"]) && strOrNull(b["period"]) && strOrNull(b["attribution"]))
    return { label: "What a person remembers", quote: b["quote"], period: b["period"], attribution: b["attribution"] };
  if (b["label"] === "Official statement" && exactKeys(b, ["label", "text", "body", "statementDate", "scope"]) && str(b["text"]) && str(b["body"]) && str(b["statementDate"]) && str(b["scope"]))
    return { label: "Official statement", text: b["text"], body: b["body"], statementDate: b["statementDate"], scope: b["scope"] };
  return null;
}

/** Strict validation. A story with any invalid block is dropped whole (never partly shown); an invalid envelope refuses everything. */
export function parseStories(raw: unknown): StoriesData | null {
  if (!obj(raw) || findForbiddenField(raw) !== null) return null;
  const list = raw["stories"], meta = raw["meta"];
  if (!Array.isArray(list) || !obj(meta) || (meta["datasetKind"] !== "synthetic" && meta["datasetKind"] !== "approved")) return null;
  const stories: PublicStory[] = [];
  for (const s of list) {
    if (!obj(s) || !exactKeys(s, ["id", "locationId", "slug", "title", "blocks"]) || !str(s["id"]) || !str(s["locationId"]) || !str(s["slug"]) || !str(s["title"]) || !Array.isArray(s["blocks"]) || s["blocks"].length === 0) continue;
    const blocks = s["blocks"].map(parseBlock);
    if (blocks.some((b) => b === null)) continue;
    stories.push({ id: s["id"], locationId: s["locationId"], slug: s["slug"], title: s["title"], blocks: blocks as PublicBlock[] });
  }
  return { stories, synthetic: meta["datasetKind"] === "synthetic" };
}

export async function fetchStories(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<StoriesResult> {
  try {
    // no-store: a withdrawn quote must disappear on the next load, not stay in a browser cache
    const res = await apiFetch(fetcher, `${API_BASE}/stories`, { signal, credentials: "omit", cache: "no-store", headers: { Accept: "application/json" } });
    if (res.status === 404) return { status: "missing" };
    if (!res.ok) return { status: "error", retryable: res.status >= 500 };
    const data = parseStories(await res.json());
    return data ? { status: "ok", data } : { status: "error", retryable: false };
  } catch {
    return { status: "error", retryable: true };
  }
}
