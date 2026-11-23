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
    // Listen on IPv4 explicitly: on systems where "localhost" resolves to ::1 first (Node 17+ on macOS), Vite would listen on IPv6 only
    // and run.sh's readiness check, the port check and the API proxy, which all use 127.0.0.1, would never see it.
    server: { proxy, host: "127.0.0.1" },
    preview: { proxy, host: "127.0.0.1" },
    // Some tests dynamically import the 3D street page or MapLibre (hundreds of KB). Measured: world.test.ts "walking starts" takes about 1 s alone but
    // 5.5 s with all workers busy, which crossed the 5 s default and failed in the full suite. 20 s covers a loaded CI runner without hiding hangs.
    test: { environment: "jsdom", globals: false, include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["src/test-setup.ts"], testTimeout: 20_000, hookTimeout: 20_000 },
  });
});
