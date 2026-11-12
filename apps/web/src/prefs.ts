import { useEffect, useState } from "react";

/**
 * Display and accessibility preferences. Saved in localStorage, applied as data attributes on <html> so CSS can react, and
 * broadcast with a "prefs-change" event so the map (which paints in WebGL, not CSS) can recolour itself.
 */
export interface Prefs {
  /** Stronger text/background contrast, solid surfaces, thicker focus rings. */
  contrast: "standard" | "high";
  /** Okabe–Ito palette: distinguishable with protanopia, deuteranopia and tritanopia. */
  palette: "standard" | "cvd";
  /** Root text size in percent. */
  text: 100 | 115 | 130 | 150;
  /** "system" follows the OS setting; "reduce" always removes motion. */
  motion: "system" | "reduce";
  /** More letter/word/line spacing and a plainer font. */
  readable: boolean;
  /** Underline every link, not only in running text. */
  underline: boolean;
  /** 3D map detail: auto drops the finest layers on software WebGL or very weak hardware. */
  detail: "auto" | "high" | "low";
}

export const DEFAULT_PREFS: Prefs = { contrast: "standard", palette: "standard", text: 100, motion: "system", readable: false, underline: false, detail: "auto" };
const KEY = "makarba.prefs.v1";

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    const p = { ...DEFAULT_PREFS, ...raw };
    // never trust stored values blindly
    if (!["standard", "high"].includes(p.contrast)) p.contrast = "standard";
    if (!["standard", "cvd"].includes(p.palette)) p.palette = "standard";
    if (![100, 115, 130, 150].includes(p.text)) p.text = 100;
    if (!["system", "reduce"].includes(p.motion)) p.motion = "system";
    p.readable = !!p.readable; p.underline = !!p.underline;
    if (!["auto", "high", "low"].includes(p.detail)) p.detail = "auto";
    return p;
  } catch { return { ...DEFAULT_PREFS }; }
}

let current: Prefs = typeof window === "undefined" ? { ...DEFAULT_PREFS } : loadPrefs();

export function applyPrefs(p: Prefs, root: HTMLElement = document.documentElement) {
  root.dataset["contrast"] = p.contrast;
  root.dataset["palette"] = p.palette;
  root.dataset["motion"] = p.motion;
  root.dataset["readable"] = p.readable ? "on" : "off";
  root.dataset["underline"] = p.underline ? "on" : "off";
  root.style.fontSize = p.text === 100 ? "" : `${p.text}%`;
}

export function getPrefs(): Prefs { return current; }

export function setPrefs(next: Partial<Prefs>) {
  current = { ...current, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode: still applies for this visit */ }
  applyPrefs(current);
  window.dispatchEvent(new Event("prefs-change"));
}

export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [p, setP] = useState(current);
  useEffect(() => {
    const on = () => setP(current);
    window.addEventListener("prefs-change", on);
    return () => window.removeEventListener("prefs-change", on);
  }, []);
  return [p, setPrefs];
}

if (typeof document !== "undefined") applyPrefs(current);
