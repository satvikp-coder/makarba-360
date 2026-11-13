import { useEffect, useRef } from "react";

/** Drifting particulates over the map for the Air lens: more, larger and darker as PM2.5 rises (level 0..1). Decorative. */
export function AirParticles({ level }: { level: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lvl = useRef(level);
  lvl.current = level;
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext("2d");
    if (!cv || !ctx || /jsdom/i.test(navigator.userAgent)) return;
    let w = 0, h = 0, raf = 0, last = 0;
    const size = () => { w = cv.width = cv.clientWidth; h = cv.height = cv.clientHeight; };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    const ps = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, d: Math.random() * 6.28 }));
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 33) return;   // ~30 fps is plenty for drifting dust
      const dt = last ? (now - last) / 1000 : 0; last = now;
      const n = Math.round(60 + 200 * lvl.current);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        const p = ps[i]!;
        p.x += (0.012 + 0.02 * p.z) * dt; p.y += Math.sin(now / 1800 + p.d) * 0.0025 * dt * 60 * 0.05;
        if (p.x > 1.02) { p.x = -0.02; p.y = Math.random(); }
        ctx.fillStyle = `rgba(${110 - 40 * lvl.current}, ${95 - 35 * lvl.current}, 70, ${0.18 + 0.4 * p.z * (0.4 + lvl.current)})`;
        const r = (0.8 + 1.8 * p.z) * (0.7 + lvl.current);
        ctx.fillRect(p.x * w, p.y * h, r, r);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="air-particles" aria-hidden="true" />;
}
