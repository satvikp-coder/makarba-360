import { defineConfig } from "vitest/config";

// The database test files share one PostgreSQL database and reset it, so they must not run in parallel.
export default defineConfig({ test: { fileParallelism: false } });
