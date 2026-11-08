import { describe, expect, it } from "vitest";
import { gpsQuality, validatePosition } from "./position.js";

const now = new Date("2026-11-08T12:00:00Z");
const fix = { state: "device_fix", permissionState: "granted", lat: 10.5, lon: 10.5, accuracyM: 12, capturedAt: "2026-11-08T11:59:00Z" };
const errs = (x: unknown) => { const r = validatePosition(x, now); return r.ok ? {} : r.errors; };

describe("GPS quality bands (protocol: <=20 good, 20-50 check, >50 low)", () => {
  it("classifies at the boundaries", () => {
    expect([0, 20, 20.1, 50, 50.1, 5000].map(gpsQuality)).toEqual(["good", "good", "check", "check", "low", "low"]);
  });
});

describe("position validation", () => {
  it("accepts a good device fix and reports its quality", () => {
    expect(validatePosition(fix, now)).toMatchObject({ ok: true, quality: "good", value: { accuracyM: 12 } });
    expect(validatePosition({ ...fix, accuracyM: 80 }, now)).toMatchObject({ ok: true, quality: "low" });   // low quality is allowed, it prompts recapture
  });
  it("rejects fixes without permission, accuracy or time, from the future, too old, or outside the globe", () => {
    expect(errs({ ...fix, permissionState: "denied" })["permissionState"]).toBeDefined();
    expect(errs({ ...fix, accuracyM: undefined })["accuracyM"]).toBeDefined();
    expect(errs({ ...fix, accuracyM: -1 })["accuracyM"]).toBeDefined();
    expect(errs({ ...fix, capturedAt: undefined })["capturedAt"]).toBeDefined();
    expect(errs({ ...fix, capturedAt: "2026-11-08T13:00:00Z" })["capturedAt"]).toMatch(/future/);
    expect(errs({ ...fix, capturedAt: "2026-11-06T11:00:00Z" })["capturedAt"]).toMatch(/older/);
    expect(errs({ ...fix, lat: 91 })["lat"]).toBeDefined();
    expect(errs({ ...fix, lon: -181 })["lon"]).toBeDefined();
    expect(errs({ ...fix, lat: "10" })["lat"]).toBeDefined();
    expect(errs({ ...fix, lat: NaN })["lat"]).toBeDefined();
  });
  it("a manual pin has a reason and never an invented accuracy or capture time", () => {
    const pin = { state: "manual_pin", permissionState: "granted", lat: 10.5, lon: 10.5, reason: "moved off the road for safety" };
    expect(validatePosition(pin, now).ok).toBe(true);
    expect(errs({ ...pin, reason: undefined })["reason"]).toBeDefined();
    expect(errs({ ...pin, accuracyM: 10 })["accuracyM"]).toMatch(/no accuracy/);
    expect(errs({ ...pin, capturedAt: "2026-11-08T11:59:00Z" })["capturedAt"]).toBeDefined();
  });
  it("denied and unavailable carry no coordinates and must explain why", () => {
    expect(validatePosition({ state: "denied", permissionState: "denied", reason: "participant declined location" }, now).ok).toBe(true);
    expect(validatePosition({ state: "unavailable", permissionState: "unsupported", reason: "no GPS on device" }, now).ok).toBe(true);
    expect(errs({ state: "denied", permissionState: "denied" })["reason"]).toBeDefined();
    expect(errs({ state: "denied", permissionState: "denied", reason: "x", lat: 10, lon: 10 })["state"]).toBeDefined();
    expect(errs({ state: "denied", permissionState: "granted", reason: "x" })["permissionState"]).toBeDefined();
  });
  it("rejects unknown states and garbage without throwing", () => {
    for (const junk of [null, 1, "x", [], {}, { state: "guess", permissionState: "granted" }, { state: "device_fix", permissionState: "maybe" }]) expect(validatePosition(junk, now).ok).toBe(false);
  });
});
