import { runConformance, summarize } from "./public-conformance.js";

const base = process.argv[2];
if (!base) { console.error("usage: pnpm --filter @makarba/api conformance <base-url, e.g. http://127.0.0.1:4010/api/v1/public>"); process.exit(2); }
const checks = await runConformance(base.replace(/\/$/, ""));
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.id}${c.ok ? "" : "  -> " + c.detail}`);
const { passed, failed } = summarize(checks);
console.log(`\n${passed}/${checks.length} checks passed against ${base}`);
process.exit(failed.length ? 1 : 0);
