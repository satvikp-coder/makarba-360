/**
 * Researcher-side import: validates a private file of approved recollections and writes ONLY the publishable subset to data/content/community.json.
 *   pnpm --filter @makarba/web community:check <file.json> [--dry-run] [--drop-rejected] [--as-of YYYY-MM-DD] [--out path]
 * Rejected entries block the write (exit 1) unless --drop-rejected is given. Output never echoes entry text, so a rejected identifier is not copied into logs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { importCommunity, type ImportReport } from "./communityModel.js";

const defaultOut = () => fileURLToPath(new URL("../../../../data/content/community.json", import.meta.url));
const flag = (a: string[], n: string) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };

export function run(argv: string[], log: (s: string) => void = console.log, today = new Date().toISOString().slice(0, 10)): number {
  const file = argv.find((a, i) => !a.startsWith("--") && !["--as-of", "--out"].includes(argv[i - 1] ?? ""));
  if (!file) { log("usage: community:check <file.json> [--dry-run] [--drop-rejected] [--as-of YYYY-MM-DD] [--out path]"); return 2; }
  const asOf = flag(argv, "--as-of") ?? today;
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch { log(`cannot read ${file} as JSON`); return 2; }
  const rep: ImportReport = importCommunity(raw, { asOf });
  for (const r of rep.rejected) log(`REJECTED entry ${r.index}${r.id ? ` (${r.id})` : ""}: ${r.errors.join("; ")}`);
  log(`${rep.accepted} valid, ${rep.rejected.length} rejected, ${rep.suppressed} held back by small-cell suppression (fewer than ${rep.doc.minCellSize} distinct consents in a theme or locality), ${rep.doc.entries.length} publishable.`);
  if (rep.rejected.length && !argv.includes("--drop-rejected")) { log("Nothing written: fix the rejected entries, or re-run with --drop-rejected to publish only the rest."); return 1; }
  if (argv.includes("--dry-run")) { log("Dry run: nothing written."); return 0; }
  const out = flag(argv, "--out") ?? defaultOut();
  writeFileSync(out, `${JSON.stringify(rep.doc, null, 2)}\n`, "utf8");
  log(`Wrote ${out} (status ${rep.doc.status}).`);
  return 0;
}

if (import.meta.url.startsWith("file:") && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(run(process.argv.slice(2)));
