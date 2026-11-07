/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: run `pnpm dev:mock` (synthetic API on :4010) and `pnpm --filter @makarba/web dev`.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:4010" } },
  test: { environment: "jsdom", globals: false },
});
