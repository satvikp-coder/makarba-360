/**
 * Dual-mode journey harness (#113). The acceptance assertions (acceptance.ts) talk only to this interface, so the SAME assertions run
 * against the in-process synthetic composition and against a real environment seeded with synthetic data. Nothing in the assertions
 * changes between modes; if the real environment cannot satisfy them it fails.
 */
export type Actor = "lead" | "administrator" | "researcher" | "anonymous";
export interface CaptureInput {
  seq: number;
  consent: "granted" | "refused";
  heldAt: string;                     // where the interview was held (private)
  discussed: string[];                // subject places
  rating?: number | null;
  reason?: "answered" | "unsure" | "refused" | "not_asked";
}
export interface Captured {
  id: string | null;                  // null when the interview ended without consent
  /** The exact position the researcher captured. Used ONLY to assert that it never appears publicly. */
  privatePosition: { lat: number; lon: number } | null;
  savedAndReceived: boolean;
}
export interface JourneyAdapter {
  readonly mode: "synthetic" | "live";
  reset(): Promise<void>;
  capture(i: CaptureInput): Promise<Captured>;
  /** Returns false when the actor is not allowed to approve. */
  approve(id: string, as: Actor): Promise<boolean>;
  withdraw(id: string): Promise<void>;
  /** Runs aggregation + disclosure + independent publication and makes the public snapshot current. */
  publish(): Promise<void>;
  /** What an anonymous visitor receives for one place (the public insights payload for that place's cohort). */
  publicSnapshot(place: string): Promise<unknown>;
}
