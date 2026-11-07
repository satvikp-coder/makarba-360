import { describe, expect, it } from "vitest";
import { EnvError, loadMockEnv, loadServerEnv, redactEnv, sharedSecretNames } from "./index.js";

const local = { DATABASE_URL: "postgres://u:p@localhost:5432/d", SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz012345" };
const strongSecret = "Zx9!qL2#vB7$kT4&mN8*pR1^wY5@cD3%hG6(jF0)sA-uE+iO";
const prod = {
  NODE_ENV: "production", APP_ENV: "production",
  DATABASE_URL: "postgres://svc:Kq83nd02xZpL@db.internal.example.org:5432/app?sslmode=require",
  SESSION_SECRET: strongSecret,
};

const fails = (src: Record<string, string>, re: RegExp) => {
  expect(() => loadServerEnv(src)).toThrow(EnvError);
  expect(() => loadServerEnv(src)).toThrow(re);
};

describe("loadServerEnv", () => {
  it("loads a valid local env with defaults", () => {
    const e = loadServerEnv(local);
    expect(e.API_PORT).toBe(4000);
    expect(e.APP_ENV).toBe("local");
  });
  it("fails clearly when values are missing", () => {
    fails({}, /DATABASE_URL.*SESSION_SECRET/);
  });
  it("does not leak secret values in errors", () => {
    for (const bad of [{ ...local, SESSION_SECRET: "short-secret-value" }, { ...prod, SESSION_SECRET: "replace-with-a-random-string-of-at-least-32-characters-xx" }]) {
      try { loadServerEnv(bad); } catch (e) {
        expect(String(e)).not.toContain(bad.SESSION_SECRET);
        expect(String(e)).not.toContain("Kq83nd02xZpL");
        continue;
      }
      throw new Error("expected failure");
    }
  });
});

describe("environment isolation", () => {
  it("accepts a well-formed production env", () => {
    expect(loadServerEnv(prod).APP_ENV).toBe("production");
  });
  it("requires APP_ENV when NODE_ENV=production", () => {
    const { APP_ENV: _omit, ...rest } = prod;
    void _omit;
    fails(rest, /APP_ENV: required/);
  });
  it("refuses development placeholders outside local", () => {
    fails({ ...prod, SESSION_SECRET: "replace-with-a-random-string-of-at-least-32-characters-xx" }, /SESSION_SECRET: placeholder/);
    fails({ ...prod, DATABASE_URL: "postgres://makarba_dev:makarba_dev_password@db.internal.example.org/x?sslmode=require" }, /DATABASE_URL: placeholder/);
  });
  it("refuses a local database in staging/production and a remote one locally", () => {
    fails({ ...prod, DATABASE_URL: "postgres://svc:Kq83nd02xZpL@localhost/app?sslmode=require" }, /must not use a local database/);
    fails({ ...local, DATABASE_URL: "postgres://svc:Kq83nd02xZpL@db.prod.example.org/app?sslmode=require" }, /local environment must use a local database/);
  });
  it("requires TLS to the database outside local", () => {
    fails({ ...prod, APP_ENV: "staging", DATABASE_URL: "postgres://svc:Kq83nd02xZpL@db.internal.example.org/app" }, /sslmode/);
  });
  it("requires a long, varied production secret", () => {
    fails({ ...prod, SESSION_SECRET: "Zx9!qL2#vB7$kT4&mN8*pR1^wY5@cD3%hG6(jF" }, /at least 48/);
    fails({ ...prod, SESSION_SECRET: "a".repeat(64) }, /variety/);
  });
  it("blocks APP_ENV=local under NODE_ENV=production", () => {
    fails({ ...prod, APP_ENV: "local", DATABASE_URL: local.DATABASE_URL }, /not allowed with NODE_ENV=production/);
  });
  it("detects secrets shared between staging and production", () => {
    expect(sharedSecretNames(prod, { ...prod, DATABASE_URL: "postgres://other@h/x" })).toEqual(["SESSION_SECRET"]);
    expect(sharedSecretNames(prod, { ...prod, SESSION_SECRET: "different" + strongSecret, DATABASE_URL: "postgres://other@h/x" })).toEqual([]);
  });
});

describe("redactEnv", () => {
  it("never shows server-only values", () => {
    const r = redactEnv({ ...prod, API_PORT: 4000 });
    expect(JSON.stringify(r)).not.toContain(strongSecret);
    expect(JSON.stringify(r)).not.toContain("Kq83nd02xZpL");
    expect(r.API_PORT).toBe(4000);
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
