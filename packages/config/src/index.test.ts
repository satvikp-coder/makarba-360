import { describe, expect, it } from "vitest";
import { EnvError, loadMockEnv, loadServerEnv } from "./index.js";

const ok = { DATABASE_URL: "postgres://x", SESSION_SECRET: "s".repeat(32) };

describe("loadServerEnv", () => {
  it("loads valid env with defaults", () => {
    expect(loadServerEnv(ok).API_PORT).toBe(4000);
  });
  it("fails clearly when values are missing", () => {
    expect(() => loadServerEnv({})).toThrow(EnvError);
    expect(() => loadServerEnv({})).toThrow(/DATABASE_URL.*SESSION_SECRET/);
  });
  it("does not leak secret values in errors", () => {
    try {
      loadServerEnv({ ...ok, SESSION_SECRET: "short-secret-value" });
    } catch (e) {
      expect(String(e)).not.toContain("short-secret-value");
      return;
    }
    throw new Error("expected failure");
  });
});

describe("loadMockEnv", () => {
  it("needs no secrets and defaults to port 4010", () => {
    expect(loadMockEnv({}).API_PORT).toBe(4010);
  });
  it("refuses production", () => {
    expect(() => loadMockEnv({ NODE_ENV: "production" })).toThrow(/never run/);
  });
});
