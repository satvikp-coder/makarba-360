import { defineConfig, loadEnv } from "vite";
import { defineConfig as defineTest } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev: run `pnpm dev:mock` (synthetic API on :4010) and `pnpm --filter @makarba/web dev`.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const proxy = { "/api": `http://127.0.0.1:${env.MOCK_API_PORT ?? "4010"}` };
  return defineTest({
    plugins: [react()],
    // All site content lives in the repository's data/ folder (JSON + images); it is served as-is, so editing a file there updates the site.
    publicDir: "../../data",
    // maplibre-gl 6 starts its worker from a URL relative to its own module; pre-bundling would move the module away from the worker file.
    optimizeDeps: { exclude: ["maplibre-gl"] },
    // MOCK_API_PORT lets a second checkout run its own mock without clashing (default 4010, as in CI).
    server: { proxy },
    preview: { proxy },
    test: { environment: "jsdom", globals: false, include: ["src/**/*.test.{ts,tsx}"] },
  });
});
