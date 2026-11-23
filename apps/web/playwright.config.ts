import { defineConfig } from "@playwright/test";

// Real-browser journeys against the synthetic mock API. The map is fully offline (no tiles); the offline spec aborts every non-local request.
// MOCK_API_PORT / WEB_PORT (defaults 4010 / 5173, as in CI) let a second local checkout run the suite without reusing another's servers.
const API = process.env.MOCK_API_PORT ?? "4010";
const WEB = process.env.WEB_PORT ?? "5173";
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // map tests wait up to 25 s for software-rendered WebGL to be ready; 30 s left too little for the rest of the test on loaded runners
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${WEB}`, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm --filter @makarba/api dev:mock", url: `http://127.0.0.1:${API}/health`, env: { API_PORT: API, WEB_PORT: WEB }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    // E2E_TARGET=preview serves the production build (run `pnpm build` first), which is what visitors get; the default is the dev server.
    process.env.E2E_TARGET === "preview"
      ? { command: `pnpm exec vite preview --host 127.0.0.1 --port ${WEB} --strictPort`, url: `http://127.0.0.1:${WEB}`, env: { MOCK_API_PORT: API }, reuseExistingServer: false, timeout: 60_000 }
      : { command: `pnpm exec vite --host 127.0.0.1 --port ${WEB} --strictPort`, url: `http://127.0.0.1:${WEB}`, env: { MOCK_API_PORT: API }, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
  // The street-level 3D scene is heavy on software WebGL: it runs after everything else so it never starves parallel journeys.
  projects: [
    { name: "chromium", use: { browserName: "chromium" }, testIgnore: /street\.spec/ },
    { name: "street", use: { browserName: "chromium" }, testMatch: /street\.spec/, dependencies: ["chromium"] },
  ],
});
