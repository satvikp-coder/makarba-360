import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("api scaffold", () => {
  it("serves health with no-store and no framework banner", async () => {
    const r = await request(createApp()).get("/health");
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["x-powered-by"]).toBeUndefined();
  });
  it("returns 404 for unknown routes", async () => {
    expect((await request(createApp()).get("/nope")).status).toBe(404);
  });
});
