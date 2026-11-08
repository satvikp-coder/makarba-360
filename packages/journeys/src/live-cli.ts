import { configFromEnv, preflight } from "./live-adapter.js";

const cfg = configFromEnv(process.env);
if (!cfg) { console.error("BLOCKED - LIVE SERVICE MISSING: set LIVE_API_BASE (and LIVE_AUTH_JSON) to a test environment seeded with synthetic data."); process.exit(3); }
const p = await preflight(cfg);
if (p.ok) { console.log("preflight OK: now run  LIVE_API_BASE=... pnpm --filter @makarba/journeys test"); process.exit(0); }
console.error("BLOCKED - LIVE SERVICE MISSING. These must exist before the live journey can run:");
for (const m of p.missing) console.error(` - ${m.id}: ${m.why}\n     ${m.detail}`);
process.exit(3);
