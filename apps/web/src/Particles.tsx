import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion.js";

/**
 * Particle field that gathers into a word, drifts, and scatters from the pointer (after the DSTNS WebKit boot film).
 * Decorative only: aria-hidden, no information of its own. Under reduced motion it draws the settled word once.
 * Without a 2D canvas (tests, very old engines) it renders nothing visible.
 */
export function Particles({ text = "360°", className = "particles", color = "246,242,233", density = 5 }: { text?: string; className?: string; color?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (/jsdom/i.test(navigator.userAgent)) return;   // no 2D canvas in the test DOM
    const ctx = cv?.getContext?.("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    type P = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; d: number; a: number };
    let ps: P[] = [];
    const ptr = { x: -9999, y: -9999 };
    const layout = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sample the word's pixels from an offscreen canvas
      const off = document.createElement("canvas"); off.width = w; off.height = h;
      const o = off.getContext("2d");
      if (!o) return;
      o.fillStyle = "#000"; o.textAlign = "center"; o.textBaseline = "middle";
      o.font = `800 ${Math.min(h * 0.62, (w / Math.max(text.length, 2)) * 1.55)}px Inter, system-ui, sans-serif`;
      o.fillText(text, w / 2, h / 2);
      const data = o.getImageData(0, 0, w, h).data;
      const targets: [number, number][] = [];
      for (let y = 0; y < h; y += density) for (let x = 0; x < w; x += density) if (data[(y * w + x) * 4 + 3]! > 128) targets.push([x, y]);
      const old = ps;
      ps = targets.map(([tx, ty], i) => old[i] ?? { x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, tx, ty, d: Math.random() * 6.28, a: 0 })
        .map((p, i) => ({ ...p, tx: targets[i]![0], ty: targets[i]![1] }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) { ctx.fillStyle = `rgba(${color},${p.a})`; ctx.fillRect(p.x, p.y, 1.8, 1.8); }
    };
    const still = () => { for (const p of ps) { p.x = p.tx; p.y = p.ty; p.a = 0.9; } draw(); };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      for (const p of ps) {
        // spring towards the word, with a slow idle drift and a soft push away from the pointer
        const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < 3600) { const f = (3600 - d2) / 3600 * 2.2; p.vx += (dx / Math.sqrt(d2 + 1)) * f; p.vy += (dy / Math.sqrt(d2 + 1)) * f; }
        const ox = Math.cos(now / 1400 + p.d) * 1.2, oy = Math.sin(now / 1700 + p.d) * 1.2;
        p.vx = (p.vx + (p.tx + ox - p.x) * 0.045) * 0.86;
        p.vy = (p.vy + (p.ty + oy - p.y) * 0.045) * 0.86;
        p.x += p.vx; p.y += p.vy;
        p.a = Math.min(0.92, p.a + 0.012);
      }
      draw();
    };
    layout();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { layout(); if (prefersReducedMotion()) still(); }) : null;
    ro?.observe(cv);
    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; };
    const leave = () => { ptr.x = ptr.y = -9999; };
    if (prefersReducedMotion()) still();
    else { raf = requestAnimationFrame(tick); cv.addEventListener("pointermove", move); cv.addEventListener("pointerleave", leave); }
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerleave", leave); };
  }, [text, color, density]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/** Loading state: a small particle swirl plus a real, announced status line. */
export function ParticleLoader({ label }: { label: string }) {
  return (
    <div className="particle-loader" role="status">
      <Particles text="•••" className="particles particles-sm" color="22,61,59" density={3} />
      <span>{label}</span>
    </div>
  );
}
