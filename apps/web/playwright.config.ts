import { defineConfig } from "@playwright/test";

// Real-browser journeys against the synthetic mock API. Basemap tiles are stubbed in the tests (no external network).
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @makarba/api dev:mock", url: "http://127.0.0.1:4010/health", env: { API_PORT: "4010" }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    // E2E_TARGET=preview serves the production build (run `pnpm build` first), which is what visitors get; the default is the dev server.
    process.env.E2E_TARGET === "preview"
      ? { command: "pnpm exec vite preview --host 127.0.0.1 --port 5173 --strictPort", url: "http://127.0.0.1:5173", reuseExistingServer: false, timeout: 60_000 }
      : { command: "pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
