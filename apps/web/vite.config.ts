import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev: run `pnpm dev:mock` (synthetic API on :4010) and `pnpm --filter @makarba/web dev`.
export default defineConfig({
  plugins: [react()],
  // maplibre-gl 6 starts its worker from a URL relative to its own module; pre-bundling would move the module away from the worker file.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  // MOCK_API_PORT lets a second checkout run its own mock without clashing (default 4010, as in CI).
  server: { proxy: { "/api": `http://127.0.0.1:${process.env.MOCK_API_PORT ?? "4010"}` } },
  test: { environment: "jsdom", globals: false, include: ["src/**/*.test.{ts,tsx}"] },
});
