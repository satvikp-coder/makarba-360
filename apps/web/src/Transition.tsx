import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { prefersReducedMotion } from "./motion.js";

/**
 * Page transition: on every route change a hairline draws across the top of the screen and a band of fine particles sweeps
 * over the map from left to right (~700 ms). Purely decorative: aria-hidden, pointer-events: none, skipped under reduced motion.
 */
export function PageTransition() {
  const loc = useLocation();
  const ref = useRef<HTMLCanvasElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (prefersReducedMotion() || /jsdom/i.test(navigator.userAgent)) return;
    const l = line.current;
    if (l) { l.classList.remove("run"); void l.offsetWidth; l.classList.add("run"); }
    const cv = ref.current, ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const w = (cv.width = innerWidth), h = (cv.height = innerHeight);
    const N = Math.min(420, Math.round((w * h) / 4200));
    const ps = Array.from({ length: N }, () => ({ y: Math.random() * h, off: Math.random() * 160 - 80, s: 0.6 + Math.random() * 1.8, a: 0.2 + Math.random() * 0.6 }));
    const t0 = performance.now(), DUR = 720;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      const front = -200 + (w + 400) * (1 - Math.pow(1 - p, 3));   // ease-out sweep
      ctx.clearRect(0, 0, w, h);
      for (const q of ps) {
        const x = front + q.off - Math.abs(Math.sin(q.y * 0.01)) * 90;
        const fade = Math.max(0, 1 - Math.abs(x - front) / 160) * (1 - p * 0.6);
        ctx.fillStyle = `rgba(230,188,108,${q.a * fade})`;
        ctx.fillRect(x, q.y, q.s, q.s);
      }
      if (p < 1) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loc.pathname]);
  return (
    <>
      <canvas ref={ref} className="page-particles" aria-hidden="true" />
      <div ref={line} className="page-hairline" aria-hidden="true" />
    </>
  );
}
