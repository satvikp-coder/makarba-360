import { defineConfig, loadEnv } from "vite";
import { defineConfig as defineTest } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev: run `pnpm dev:mock` (synthetic API on :4010) and `pnpm --filter @makarba/web dev`.
export default defineConfig(({ mode }) => {
  // GROQ_API_KEY / OLLAMA_HOST come from the shell or apps/web/.env.local (git-ignored). The key is added by this proxy on the
  // server side and is never shipped to the browser (it has no VITE_ prefix).
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const ollama = { target: env.OLLAMA_HOST ?? "http://127.0.0.1:11434", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/ollama/, "") };
  const groq = { target: "https://api.groq.com", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/groq/, "/openai/v1"),
    headers: (env.GROQ_API_KEY ? { Authorization: `Bearer ${env.GROQ_API_KEY}` } : {}) as Record<string, string> };
  // Apple Foundation Models through the local Swift bridge (tools/applefm), started by ./run.sh on macOS.
  const applefm = { target: env.APPLEFM_HOST ?? "http://127.0.0.1:11535", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/applefm/, "") };
  // /applefm, /ollama and /groq are same-origin paths, so the page's CSP stays connect-src 'self'.
  const ai = { "/applefm": applefm, "/ollama": ollama, "/groq": groq };
  return defineTest({
    plugins: [react()],
    // All site content lives in the repository's data/ folder (JSON + images); it is served as-is, so editing a file there updates the site.
    publicDir: "../../data",
    // maplibre-gl 6 starts its worker from a URL relative to its own module; pre-bundling would move the module away from the worker file.
    optimizeDeps: { exclude: ["maplibre-gl"] },
    // MOCK_API_PORT lets a second checkout run its own mock without clashing (default 4010, as in CI).
    server: { proxy: { "/api": `http://127.0.0.1:${env.MOCK_API_PORT ?? "4010"}`, ...ai } },
    preview: { proxy: ai },
    test: { environment: "jsdom", globals: false, include: ["src/**/*.test.{ts,tsx}"] },
  });
});
