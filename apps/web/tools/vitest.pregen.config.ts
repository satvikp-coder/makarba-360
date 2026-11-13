import { defineConfig } from "vitest/config";
// only for tools/pregen-ai.ts (never part of the normal test run)
export default defineConfig({ test: { include: ["tools/pregen-ai.ts"], environment: "node", testTimeout: 3_600_000 } });
