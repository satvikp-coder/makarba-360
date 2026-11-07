import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { safeRequestLogger } from "./logging.js";

describe("safeRequestLogger", () => {
  it("never logs query strings, parameters, cookies, bodies or tokens", async () => {
    const lines: string[] = [];
    const app = express();
    app.use(express.json());
    app.use(safeRequestLogger((l) => lines.push(l)));
    app.post("/interviews/:id", (_req, res) => res.json({ ok: true }));
    await request(app)
      .post("/interviews/00000000-0000-4000-8000-0000000000b1?lat=10.512345&lon=10.654321")
      .set("Cookie", "mk_session=SECRET-SESSION-TOKEN")
      .set("x-csrf-token", "SECRET-CSRF")
      .set("x-request-id", "req-abcdef12")
      .send({ answers: ["synthetic answer text"], latitude: 10.5123 });
    expect(lines).toHaveLength(1);
    const log = lines[0]!;
    for (const leak of ["lat=", "10.5123", "SECRET", "synthetic answer", "00000000-0000", "mk_session"]) expect(log, leak).not.toContain(leak);
    expect(JSON.parse(log)).toMatchObject({ method: "POST", route: "/interviews/:id", status: 200, requestId: "req-abcdef12" });
  });
  it("marks unmatched routes without echoing the URL", async () => {
    const lines: string[] = [];
    const app = express();
    app.use(safeRequestLogger((l) => lines.push(l)));
    await request(app).get("/secret/path?token=abc");
    expect(JSON.parse(lines[0]!).route).toBe("unmatched");
    expect(lines[0]).not.toContain("token=abc");
  });
  it("drops malformed request ids", async () => {
    const lines: string[] = [];
    const app = express();
    app.use(safeRequestLogger((l) => lines.push(l)));
    await request(app).get("/x").set("x-request-id", "cookie=abc;evil");
    expect(JSON.parse(lines[0]!).requestId).toBeUndefined();
  });
});
