import { readFileSync } from "node:fs";
import { validateImport } from "./index.js";

// usage: pnpm --filter @makarba/gis-io check <file.geojson> "<source>" <licence> [west,south,east,north]
const [file, source, licence, bounds] = process.argv.slice(2);
if (!file || !source || !licence) { console.error('usage: pnpm --filter @makarba/gis-io check <file.geojson> "<source>" <licence> [west,south,east,north]'); process.exit(2); }
const b = bounds ? (bounds.split(",").map(Number) as [number, number, number, number]) : undefined;
const r = validateImport(readFileSync(file, "utf8"), { source, licence, ...(b ? { bounds: b } : {}) });
console.log(JSON.stringify({ verdict: r.verdict, fileReasons: r.fileReasons, counts: r.counts, features: r.features.filter((f) => f.reasons.length || f.warnings.length) }, null, 2));
process.exit(r.verdict === "accepted" ? 0 : 1);
