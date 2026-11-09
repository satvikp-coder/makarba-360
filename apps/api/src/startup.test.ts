import request from "supertest";
import { describe, expect, it } from "vitest";
import { prepareServer } from "./startup.js";

const strong = "Zx9!qL2#vB7$kT4&mN8*pR1^wY5@cD3%hG6(jF0)sA-uE+iO";
const local = { DATABASE_URL: "postgres://u:p@localhost:5432/d", SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz012345" };
const prod = { NODE_ENV: "production", APP_ENV: "production", DATABASE_URL: "postgres://svc:Kq83nd02xZpL@db.internal.example.org:5432/app?sslmode=require", SESSION_SECRET: strong };

describe("API start-up (fail closed)", () => {
  it("starts locally; the public API is not mounted without READONLY_DATABASE_URL", async () => {
    const p = await prepareServer(local, { log: () => {} });
    expect(p.publicPool).toBeNull();
    expect((await request(p.app).get("/api/v1/public/locations")).status).toBe(404);
    expect(p.logLine).toContain("NOT mounted");
  });
  it("mounts the public API with its own read-only connection string and never logs secrets", async () => {
    const ro = "postgres://pub:Rw94ndLq02xZ@localhost:5432/d";
    const p = await prepareServer({ ...local, READONLY_DATABASE_URL: ro }, { log: () => {} });
    expect(p.publicPool).not.toBeNull();
    expect(p.logLine).toContain("public API mounted");
    for (const secret of [local.SESSION_SECRET, local.DATABASE_URL, ro, "Rw94ndLq02xZ"]) expect(p.logLine).not.toContain(secret);
    await p.publicPool!.end();
  });
  it("refuses to start with missing, weak, placeholder or cross-environment values, naming variables but never values", async () => {
    const cases: [Record<string, string>, RegExp][] = [
      [{}, /DATABASE_URL/],
      [{ ...local, SESSION_SECRET: "short" }, /SESSION_SECRET/],
      [{ ...prod, SESSION_SECRET: "replace-with-a-random-string-of-at-least-48-characters-xx" }, /SESSION_SECRET: placeholder/],
      [{ ...prod, DATABASE_URL: "postgres://svc:Kq83nd02xZpL@localhost:5432/app?sslmode=require" }, /must not use a local database host/],
      [{ ...prod, DATABASE_URL: prod.DATABASE_URL.replace("?sslmode=require", "") }, /requires sslmode/],
      [{ ...prod, APP_ENV: "local" }, /APP_ENV=local/],
      [{ NODE_ENV: "production", DATABASE_URL: prod.DATABASE_URL, SESSION_SECRET: strong }, /APP_ENV: required/],
    ];
    for (const [env, re] of cases) {
      let msg = "";
      try { await prepareServer(env, { log: () => {} }); } catch (e) { msg = String(e); }
      expect(msg, JSON.stringify(Object.keys(env))).toMatch(re);
      for (const v of Object.values(env)) if (v.length > 12) expect(msg).not.toContain(v);
    }
  });
  it("refuses a production start while the capability matrix is not approved (issue #6)", async () => {
    await expect(prepareServer(prod, { log: () => {} })).rejects.toThrow(/approved|PROPOSED|capability/i);
  });
  it("unknown routes and thrown errors answer plain JSON without stack traces or paths", async () => {
    const p = await prepareServer(local, { log: () => {} });
    const res = await request(p.app).get("/definitely/not/here");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at \w+ \(|\.ts:/);
  });
});
