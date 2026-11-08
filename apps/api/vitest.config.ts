import { defineConfig } from "vitest/config";

// The database suites share one PostGIS database and drop/recreate its schemas, so test files must not run in parallel.
export default defineConfig({ test: { fileParallelism: false } });
