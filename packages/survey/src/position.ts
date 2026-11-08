/**
 * Interview position (GPS) rules, pure (issues #48, #49, #50). Follows docs/research/gps-protocol.md: thresholds are project choices
 * (<=20 m good, 20-50 m check, >50 m low quality), never guaranteed truth. A quality verdict never blocks saving; it prompts recapture.
 * The interview position and the subject place are independent: nothing here derives one from the other.
 */
export const POSITION_STATES = ["device_fix", "manual_pin", "denied", "unavailable"] as const;
export type PositionState = (typeof POSITION_STATES)[number];
export const PERMISSION_STATES = ["granted", "denied", "prompt", "unsupported", "unknown"] as const;
export type PermissionState = (typeof PERMISSION_STATES)[number];
export type GpsQuality = "good" | "check" | "low";

export const GPS_GOOD_M = 20;
export const GPS_CHECK_M = 50;
export const MAX_FIX_AGE_MS = 24 * 3_600_000;

export function gpsQuality(accuracyM: number): GpsQuality {
  return accuracyM <= GPS_GOOD_M ? "good" : accuracyM <= GPS_CHECK_M ? "check" : "low";
}

export interface PositionInput {
  state: PositionState;
  permissionState: PermissionState;
  lat?: number;
  lon?: number;
  accuracyM?: number;
  capturedAt?: string;
  reason?: string;
}
export type PositionCheck = { ok: true; value: PositionInput; quality: GpsQuality | null } | { ok: false; errors: Record<string, string> };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validatePosition(raw: unknown, now = new Date()): PositionCheck {
  const errors: Record<string, string> = {};
  const b = (typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const state = b["state"], perm = b["permissionState"];
  if (!(POSITION_STATES as readonly unknown[]).includes(state)) errors["state"] = `one of ${POSITION_STATES.join(", ")}`;
  if (!(PERMISSION_STATES as readonly unknown[]).includes(perm)) errors["permissionState"] = `one of ${PERMISSION_STATES.join(", ")}`;
  if (Object.keys(errors).length) return { ok: false, errors };
  const reason = typeof b["reason"] === "string" ? b["reason"].trim() : undefined;
  if (b["reason"] !== undefined && (!reason || reason.length > 300)) errors["reason"] = "1 to 300 characters";
  const hasPoint = b["lat"] !== undefined || b["lon"] !== undefined;
  if (state === "denied" || state === "unavailable") {
    if (hasPoint || b["accuracyM"] !== undefined || b["capturedAt"] !== undefined) errors["state"] = `${String(state)} carries no position, accuracy or capture time`;
    if (!reason) errors["reason"] = "say why there is no position";
    if (state === "denied" && perm === "granted") errors["permissionState"] = "denied cannot have permission granted";
  } else {
    if (!isNum(b["lat"]) || (b["lat"] as number) < -90 || (b["lat"] as number) > 90) errors["lat"] = "latitude -90..90";
    if (!isNum(b["lon"]) || (b["lon"] as number) < -180 || (b["lon"] as number) > 180) errors["lon"] = "longitude -180..180";
    if (state === "device_fix") {
      if (perm !== "granted") errors["permissionState"] = "a device fix needs permission granted";
      if (!isNum(b["accuracyM"]) || (b["accuracyM"] as number) < 0 || (b["accuracyM"] as number) >= 100_000) errors["accuracyM"] = "reported metres, 0 or more";
      const t = typeof b["capturedAt"] === "string" ? new Date(b["capturedAt"]) : null;
      if (!t || Number.isNaN(t.getTime())) errors["capturedAt"] = "the time the device reported";
      else if (t.getTime() > now.getTime() + 5 * 60_000) errors["capturedAt"] = "in the future";
      else if (now.getTime() - t.getTime() > MAX_FIX_AGE_MS) errors["capturedAt"] = "older than 24 hours; capture again at the interview spot";
    } else {
      // Manual pin: never an invented accuracy, always a reason.
      if (b["accuracyM"] !== undefined) errors["accuracyM"] = "a manual pin has no accuracy";
      if (b["capturedAt"] !== undefined) errors["capturedAt"] = "a manual pin has no device capture time";
      if (!reason) errors["reason"] = "say why it was placed by hand";
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const value: PositionInput = { state: state as PositionState, permissionState: perm as PermissionState };
  if (hasPoint) { value.lat = b["lat"] as number; value.lon = b["lon"] as number; }
  if (state === "device_fix") { value.accuracyM = b["accuracyM"] as number; value.capturedAt = new Date(b["capturedAt"] as string).toISOString(); }
  if (reason) value.reason = reason;
  return { ok: true, value, quality: state === "device_fix" ? gpsQuality(value.accuracyM!) : null };
}
