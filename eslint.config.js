import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Plain-JS browser tools (no build step) run in a browser, not Node.
const browser = Object.fromEntries(["self", "window", "document", "navigator", "location", "indexedDB", "crypto", "caches", "fetch", "Response", "performance", "URL", "URLSearchParams", "Blob", "Uint8Array", "TextEncoder", "TextDecoder", "console", "setTimeout", "clients"].map((g) => [g, "readonly"]));

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "docs/**", "scripts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["tools/**/*.js"], languageOptions: { globals: browser } },
);
