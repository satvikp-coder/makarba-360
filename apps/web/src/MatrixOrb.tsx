import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion.js";

/**
 * Matrix orb: a sphere drawn as a grid of dots. Each dot is shaded as if lit from the upper left and modulated by travelling
 * ripples, so the orb reads as a living, thinking object without any imagery. States:
 *   idle     - slow breathing, faint
 *   thinking - fast swirling ripples, bright
 *   done     - one bright pulse that settles back to idle
 * Decorative (aria-hidden): the surrounding text always says what is happening. Still under reduced motion.
 */
export function MatrixOrb({ state = "idle", size = 40, grid = 13 }: { state?: "idle" | "thinking" | "done" | "error"; size?: number; grid?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const changedAt = useRef(0);
  if (stateRef.current !== state) { stateRef.current = state; changedAt.current = typeof performance !== "undefined" ? performance.now() : 0; }
  useEffect(() => {
    const cv = ref.current;
    if (!cv || /jsdom/i.test(navigator.userAgent)) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr; cv.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = size / 2, cell = size / grid;
    const dots: { x: number; y: number; nx: number; ny: number; nz: number }[] = [];
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
      const nx = (x - R) / R, ny = (y - R) / R, d2 = nx * nx + ny * ny;
      if (d2 <= 1) dots.push({ x, y, nx, ny, nz: Math.sqrt(1 - d2) });
    }
    let raf = 0;
    const draw = (now: number) => {
      const st = stateRef.current, since = now - changedAt.current;
      const t = now / 1000;
      const think = st === "thinking", err = st === "error";
      const speed = think ? 3.2 : 0.8, amp = think ? 1 : 0.45;
      const pulse = st === "done" ? Math.max(0, 1 - since / 900) : 0;
      ctx.clearRect(0, 0, size, size);
      for (const d of dots) {
        // light from the upper left, plus a rotating swirl and a radial ripple
        const light = 0.35 + 0.65 * Math.max(0, d.nx * -0.45 + d.ny * -0.55 + d.nz * 0.7);
        const ang = Math.atan2(d.ny, d.nx), r = Math.hypot(d.nx, d.ny);
        const wave = Math.sin(r * 7 - t * speed * 2) * 0.5 + Math.sin(ang * 3 + t * speed) * 0.5;
        const v = Math.min(1, light * (0.55 + amp * 0.45 * wave) + pulse * 0.6);
        // colour drifts teal -> violet -> amber around the sphere
        const hue = err ? 8 : 170 + 110 * Math.sin(ang + t * (think ? 0.9 : 0.25)) * 0.5 + (think ? 40 * Math.sin(t) : 0);
        const rad = cell * (0.16 + 0.26 * v);
        ctx.fillStyle = `hsla(${hue}, ${err ? 70 : 62}%, ${30 + 42 * v}%, ${0.25 + 0.75 * v})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, rad, 0, Math.PI * 2); ctx.fill();
      }
    };
    if (prefersReducedMotion()) { draw(0); return; }
    const loop = (now: number) => { raf = requestAnimationFrame(loop); if (!document.hidden) draw(now); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, grid]);
  return <canvas ref={ref} className={`matrix-orb mo-${state}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
