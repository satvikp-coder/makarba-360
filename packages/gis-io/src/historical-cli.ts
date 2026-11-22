import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkRegistryOnDisk, importLayer, importMeasurement } from "./historical-fs.js";
import { validatePastLayer, type MeasurementSeries, type PastLayerMeta } from "./historical.js";

/**
 * usage (from the repository root):
 *   pnpm --filter @makarba/gis-io past-layer validate <layer.geojson> <meta.json>   report only, writes nothing
 *   pnpm --filter @makarba/gis-io past-layer import   <layer.geojson> <meta.json> [--replace]
 *   pnpm --filter @makarba/gis-io past-layer measure  <series.json> [--replace]         register a measurement series (see ml/past_builtup.py)
 *   pnpm --filter @makarba/gis-io past-layer check                                  re-verify the registry and every stored layer
 * The data folder is ../../data relative to this package unless MAKARBA_DATA_DIR is set.
 */
const dataDir = resolve(process.env["MAKARBA_DATA_DIR"] ?? resolve(import.meta.dirname, "../../../data"));
const [cmd, file, metaFile, flag] = process.argv.slice(2);
if (cmd === "measure") {
  if (!file) { console.error("usage: past-layer measure <series.json> [--replace]"); process.exit(2); }
  const m = importMeasurement(dataDir, JSON.parse(readFileSync(file, "utf8")) as MeasurementSeries, { replace: metaFile === "--replace" });
  if (!m.ok) { console.error(m.reasons.map((x) => `- ${x}`).join("\n")); process.exit(1); }
  console.log(`registered ${m.series.id} (${m.series.points.length} points: ${m.series.points.map((p) => p.year).join(", ")})`);
  process.exit(0);
}
const usage = () => { console.error("usage: past-layer validate|import <layer.geojson> <meta.json> [--replace] | past-layer check"); process.exit(2); };

if (cmd === "check") {
  const problems = checkRegistryOnDisk(dataDir);
  console.log(problems.length ? problems.map((p) => `- ${p}`).join("\n") : "registry and stored layers are healthy");
  process.exit(problems.length ? 1 : 0);
}
if ((cmd !== "validate" && cmd !== "import") || !file || !metaFile) usage();
const text = readFileSync(file!, "utf8");
const meta = JSON.parse(readFileSync(metaFile!, "utf8")) as PastLayerMeta;
if (cmd === "validate") {
  const r = validatePastLayer(text, meta);
  console.log(JSON.stringify({ verdict: r.verdict, reasons: r.reasons, warnings: r.warnings, counts: r.counts, reprojected: r.reprojected }, null, 2));
  process.exit(r.verdict === "accepted" ? 0 : 1);
}
const out = importLayer(dataDir, text, meta, { replace: flag === "--replace" });
if (!out.ok) { console.error(out.reasons.map((x) => `- ${x}`).join("\n")); process.exit(1); }
console.log(`imported ${out.layer.id} (${out.layer.counts.features} features, sha256 ${out.layer.sha256.slice(0, 12)}...)`);
out.warnings.forEach((w) => console.log(`warning: ${w}`));
