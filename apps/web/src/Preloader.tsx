import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion.js";

/**
 * Start-up film, after the DSTNS boot scene: a cloud of particles gathers into the name and holds while the 3D city loads; when the
 * map has drawn, the particles fly onto its roads (nearest the centre first, so the network builds outward along itself), the map
 * fades in under them, and they thin away. One 2D canvas; decorative (aria-hidden) and never blocking input. Skipped under reduced
 * motion and in automated browsers (add ?preloader to force it). While it plays, <html data-preloading> tells the map to hold its
 * intro flight, so the roads stay where the particles land.
 */
type Pt = [number, number];
const GATHER_MS = 1150, MIN_HOLD_MS = 500, LAND_MS = 1500, SPREAD_MS = 700, FADE_MS = 900, GIVE_UP_MS = 9000;
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

const wanted = () => typeof window !== "undefined" && !/jsdom/i.test(navigator.userAgent) && !prefersReducedMotion()
  && (!navigator.webdriver || /[?&]preloader\b/.test(location.search));

/** Points that fill the name, sampled from text drawn off screen. */
function wordmark(n: number, w: number, h: number): Pt[] {
  const cw = Math.min(760, w * 0.84), fs = Math.round(cw / 6.4);
  const c = document.createElement("canvas"); c.width = cw; c.height = Math.round(fs * 1.4);
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return [];
  g.font = `800 ${fs}px Inter, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("Makarba 360°", cw / 2, c.height / 2);
  const a = g.getImageData(0, 0, c.width, c.height).data, inside: Pt[] = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < cw; x += 2) if (a[(y * cw + x) * 4 + 3]! > 128) inside.push([x, y]);
  const ox = (w - cw) / 2, oy = h / 2 - c.height / 2 - h * 0.04;
  return Array.from({ length: n }, () => { const p = inside[Math.floor(Math.random() * inside.length)] ?? [cw / 2, 0]; return [ox + p[0] + Math.random() * 2, oy + p[1] + Math.random() * 2]; });
}

/** Points along the roads (screen pixels), spread by length; each with its distance from the centre for the outward build. */
function alongRoads(lines: Pt[][], n: number, w: number, h: number): { p: Pt; d: number }[] {
  const segs: [Pt, Pt, number][] = [];
  let total = 0;
  for (const l of lines) for (let i = 1; i < l.length; i++) { const a = l[i - 1]!, b = l[i]!; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len > 0) { segs.push([a, b, len]); total += len; } }
  if (!total) return [];
  const cx = w / 2, cy = h / 2, far = Math.hypot(w, h) / 2;
  return Array.from({ length: n }, () => {
    let r = Math.random() * total, k = 0;
    while (k < segs.length - 1 && r > segs[k]![2]) { r -= segs[k]![2]; k++; }
    const [a, b, len] = segs[k]!, t = Math.min(1, r / len);
    const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return { p, d: Math.min(1, Math.hypot(p[0] - cx, p[1] - cy) / far) };
  });
}

export function Preloader() {
  const [on, setOn] = useState(() => { const w = wanted(); if (w) document.documentElement.dataset.preloading = "1"; return w; });
  const cv = useRef<HTMLCanvasElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!on) return;
    const c = cv.current, g = c?.getContext("2d");
    const finish = () => { delete document.documentElement.dataset.preloading; setOn(false); };
    if (!c || !g) { finish(); return; }
    const w = (c.width = innerWidth), h = (c.height = innerHeight);
    const n = w < 700 ? 900 : 1600;
    const word = wordmark(n, w, h);
    if (!word.length) { finish(); return; }
    // start: a loose cloud around the middle
    const from: Pt[] = word.map(() => { const a = Math.random() * 6.283, r = (0.25 + Math.random() * 0.6) * Math.max(w, h) * 0.6; return [w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 0.6]; });
    const delay = word.map(() => Math.random() * 350), size = word.map(() => 0.8 + Math.random() * 1.6), tint = word.map(() => Math.random());
    const pos: Pt[] = from.map((p) => [...p] as Pt);
    let land: { p: Pt; d: number }[] | null = null, landAt = 0, leaveAt = 0, raf = 0;
    const t0 = performance.now();
    const onReady = (e: Event) => {
      const lines = (e as CustomEvent<Pt[][]>).detail;
      land = alongRoads(lines, n, w, h);
      if (!land.length) land = null;
      landAt = Math.max(performance.now(), t0 + GATHER_MS + MIN_HOLD_MS);
      if (caption.current) caption.current.textContent = "";
    };
    document.addEventListener("makarba:map-ready", onReady);
    const giveUp = window.setTimeout(() => { if (!land && !leaveAt) leaveAt = performance.now(); }, GIVE_UP_MS);
    const tick = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, w, h);
      let veilOpacity = 1, alpha = 1;
      for (let i = 0; i < n; i++) {
        const p = pos[i]!, s = word[i]!;
        if (land && now >= landAt) {
          // fly onto the roads: outward from the centre, then glow sand as they settle
          const q = land[i]!, k = ease((now - landAt - q.d * SPREAD_MS) / LAND_MS);
          p[0] = s[0] + (q.p[0] - s[0]) * k; p[1] = s[1] + (q.p[1] - s[1]) * k;
        } else if (leaveAt) {
          const k = ease((now - leaveAt) / FADE_MS);
          p[0] = s[0] + (s[0] - w / 2) * k * 0.6; p[1] = s[1] + (s[1] - h / 2) * k * 0.6;
        } else {
          // gather into the name, then breathe in place
          const k = ease((t - delay[i]!) / GATHER_MS), f = from[i]!;
          const wob = k >= 1 ? Math.sin(now / 600 + i) * 0.6 : 0;
          p[0] = f[0] + (s[0] - f[0]) * k + wob; p[1] = f[1] + (s[1] - f[1]) * k + Math.cos(now / 700 + i) * (k >= 1 ? 0.6 : 0);
        }
      }
      if (land && now >= landAt) {
        const e = now - landAt;
        veilOpacity = 1 - ease((e - LAND_MS * 0.55) / (LAND_MS * 0.6));
        alpha = 1 - ease((e - LAND_MS - SPREAD_MS * 0.6) / FADE_MS);
        if (e > LAND_MS + SPREAD_MS + FADE_MS) { finish(); return; }
      } else if (leaveAt) {
        const e = now - leaveAt;
        veilOpacity = alpha = 1 - ease(e / FADE_MS);
        if (e > FADE_MS) { finish(); return; }
      }
      for (let i = 0; i < n; i++) {
        const p = pos[i]!, sand = tint[i]! > 0.82;
        g.fillStyle = sand ? `rgba(226,181,101,${alpha})` : `rgba(22,61,59,${alpha * (0.55 + 0.45 * tint[i]!)})`;
        g.fillRect(p[0], p[1], size[i]!, size[i]!);
      }
      if (veil.current) veil.current.style.opacity = String(veilOpacity);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(giveUp); document.removeEventListener("makarba:map-ready", onReady); };
  }, [on]);
  if (!on) return null;
  return (
    <div className="preloader" aria-hidden="true">
      <div className="preloader-veil" ref={veil} />
      <canvas ref={cv} className="preloader-canvas" />
      <p className="preloader-caption" ref={caption}>Building the 3D city…</p>
    </div>
  );
}
