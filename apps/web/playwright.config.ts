import { defineConfig } from "@playwright/test";

// Real-browser journeys against the synthetic mock API. The map is fully offline (no tiles); the offline spec aborts every non-local request.
// MOCK_API_PORT / WEB_PORT (defaults 4010 / 5173, as in CI) let a second local checkout run the suite without reusing another's servers.
const API = process.env.MOCK_API_PORT ?? "4010";
const WEB = process.env.WEB_PORT ?? "5173";
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${WEB}`, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @makarba/api dev:mock", url: `http://127.0.0.1:${API}/health`, env: { API_PORT: API }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    // E2E_TARGET=preview serves the production build (run `pnpm build` first), which is what visitors get; the default is the dev server.
    process.env.E2E_TARGET === "preview"
      ? { command: `pnpm exec vite preview --host 127.0.0.1 --port ${WEB} --strictPort`, url: `http://127.0.0.1:${WEB}`, env: { MOCK_API_PORT: API }, reuseExistingServer: false, timeout: 60_000 }
      : { command: `pnpm exec vite --host 127.0.0.1 --port ${WEB} --strictPort`, url: `http://127.0.0.1:${WEB}`, env: { MOCK_API_PORT: API }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
