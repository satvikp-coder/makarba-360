import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked for reduced motion. Environments without matchMedia (tests, old engines) get the calm path. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  // the site's own "Reduce motion" setting overrides the OS when switched on
  if (document.documentElement.dataset["motion"] === "reduce") return true;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(prefersReducedMotion());
    mq.addEventListener?.("change", on);
    window.addEventListener("prefs-change", on);
    return () => { mq.removeEventListener?.("change", on); window.removeEventListener("prefs-change", on); };
  }, []);
  return reduced;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Counts up to `target` once. Only ever used for real, ready values: suppressed or missing values are never passed here, so they can
 * never be shown as a number. Under reduced motion (or without requestAnimationFrame) the final value is shown immediately.
 */
export function useCountUp(target: number, duration = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(() => (reduced || typeof requestAnimationFrame !== "function" || target <= 1 ? target : 1));
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== "function" || target <= 1) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.max(1, Math.round(easeOutCubic(t) * target)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return value;
}

/**
 * Spring easing (damped harmonic oscillator, unit mass, starting at rest), after the motion model in DSTNS WebKit.
 * Critically damped by default, so camera moves glide in and settle without overshoot or a hard stop.
 */
export function springAt(t: number, k = 120, c = 2 * Math.sqrt(120)): number {
  const w0 = Math.sqrt(k), z = c / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
/** A spring as a 0..1 easing over a fixed duration (normalised so it lands exactly on 1). */
export const springEase = (t: number) => (t >= 1 ? 1 : springAt(t * 0.85) / springAt(0.85));
/** Smooth start and finish for long camera flights: a sine in-out has no jerk at either end. */
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Animates a number towards `target` whenever it changes (spring, ~600 ms). Final value at once under reduced motion. */
export function useTween(target: number, duration = 650): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== "function") { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    let from = 0;
    setValue((v) => { from = v; return v; });
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(from + (target - from) * springEase(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return value;
}
