import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { fmt, upTo, type Point, type Series } from "./outlook.js";

/**
 * A forecast fan chart: the recorded history, the TimesFM forecast from today to the chosen year and its 80% range (10th to 90th
 * percentile). It draws in sequence (history, then forecast, then range, then the end value) once it scrolls into view, so a page
 * of charts reveals one chart at a time instead of everything at once. Hover, touch or the arrow keys read any year.
 */
export function ForecastChart({ s, endYear, height = 200, detailed = false, historyYears }: { s: Series; endYear: number; height?: number; detailed?: boolean; historyYears?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const inView = useInView(wrap, { once: true, margin: "0px 0px -8% 0px" });
  const reduce = useReducedMotion();
  const show = inView || reduce || typeof IntersectionObserver === "undefined";

  const f = useMemo(() => upTo(s, endYear).forecast, [s, endYear]);
  const hist = useMemo(() => (historyYears ? s.history.filter((p) => p.year > s.history[s.history.length - 1]!.year - historyYears) : s.history), [s, historyYears]);
  const last = s.history[s.history.length - 1]!;
  const m = detailed ? { t: 18, r: 64, b: 30, l: 56 } : { t: 12, r: 46, b: 22, l: 10 };
  const all = [...hist, ...f];
  const x = useMemo(() => scaleLinear({ domain: [Math.min(...all.map((p) => p.year)), endYear], range: [m.l, width - m.r] }), [all, endYear, width, m.l, m.r]);
  const yExt = all.flatMap((p) => [p.value, p.lo ?? p.value, p.hi ?? p.value]);
  const y = useMemo(() => scaleLinear({ domain: [Math.min(...yExt), Math.max(...yExt)], range: [height - m.b, m.t], nice: true }), [yExt.join(","), height, m.b, m.t]);
  const fc = [last, ...f];
  const end = f[f.length - 1] ?? last;
  const ease = [0.22, 1, 0.36, 1] as const;
  // the first reveal plays in sequence; later changes (a new end year) redraw quickly
  const intro = useRef(true);
  useEffect(() => { if (!show) return; const id = window.setTimeout(() => { intro.current = false; }, 2400); return () => clearTimeout(id); }, [show]);
  const t = (delay: number, duration = 0.9) => (reduce ? { duration: 0 } : intro.current ? { duration, delay, ease } : { duration: duration * 0.6, delay: delay * 0.15, ease });

  // reading a year: hover, touch, or arrow keys once the chart has focus
  const years = useMemo(() => all.map((p) => p.year), [all]);
  const [hover, setHover] = useState<number | null>(null);
  const point = (yr: number): Point & { kind: string } => {
    const fp = f.find((p) => p.year === yr);
    if (fp) return { ...fp, kind: "forecast" };
    const hp = s.history.find((p) => p.year === yr) ?? last;
    return { ...hp, kind: "recorded" };
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), yr = x.invert(((e.clientX - r.left) / r.width) * width);
    setHover(years.reduce((a, b) => (Math.abs(b - yr) < Math.abs(a - yr) ? b : a), years[0]!));
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const i = hover === null ? years.length - 1 : years.indexOf(hover);
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setHover(years[Math.max(0, Math.min(years.length - 1, i + d))]!);
  };
  const h = hover !== null ? point(hover) : null;
  const gid = `fan-${s.id.replace(/[^a-z0-9]/gi, "")}-${detailed ? "d" : "c"}`;
  const xTicks = x.ticks(detailed ? Math.max(4, Math.floor(width / 110)) : 2).filter((v) => Number.isInteger(v));
  const yTicks = y.ticks(detailed ? 5 : 2);

  return (
    <div className={`fchart${detailed ? " fchart-detailed" : ""}`} ref={wrap}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" tabIndex={0}
        aria-label={`${s.label}: history to ${Math.floor(last.year)} and forecast to ${endYear}${h ? `; ${Math.floor(h.year)}: ${fmt(h.value)} ${s.unit}` : ""}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <LinearGradient id={gid} from="var(--accent)" to="var(--accent)" fromOpacity={0.32} toOpacity={0.04} vertical />
        {detailed && yTicks.map((v) => <line key={v} x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} className="fchart-grid" />)}
        {/* today */}
        <motion.line x1={x(last.year)} x2={x(last.year)} y1={m.t - 4} y2={height - m.b} className="fchart-now" initial={{ pathLength: 0 }} animate={show ? { pathLength: 1 } : {}} transition={t(0.1, 0.6)} />
        {detailed && <text x={x(last.year) + 6} y={m.t + 6} className="fchart-label">Today</text>}
        {/* 3: the 80% range */}
        {f.length > 0 && (
          <motion.g initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : {}} transition={t(1.45, 0.8)}>
            <AreaClosed<Point> key={`band-${endYear}`} data={fc} x={(p) => x(p.year)} y0={(p) => y(p.lo ?? p.value)} y1={(p) => y(p.hi ?? p.value)} yScale={y} curve={curveMonotoneX} fill={`url(#${gid})`} className="fchart-band" />
          </motion.g>
        )}
        {/* 1: what was recorded */}
        <LinePath<Point> data={hist} x={(p) => x(p.year)} y={(p) => y(p.value)} curve={curveMonotoneX}>
          {({ path }) => <motion.path d={path(hist) ?? ""} className="fchart-hist" initial={{ pathLength: 0 }} animate={show ? { pathLength: 1 } : {}} transition={t(0.15, 1.1)} />}
        </LinePath>
        {/* 2: the forecast continues from today (redraws when the year changes) */}
        <LinePath<Point> data={fc} x={(p) => x(p.year)} y={(p) => y(p.value)} curve={curveMonotoneX}>
          {({ path }) => <motion.path key={`f-${endYear}`} d={path(fc) ?? ""} className="fchart-fcst" initial={{ pathLength: 0 }} animate={show ? { pathLength: 1 } : {}} transition={t(1.0, 0.9)} />}
        </LinePath>
        {/* 4: the end value */}
        <motion.g key={`end-${endYear}`} initial={{ opacity: 0, scale: 0.4 }} animate={show ? { opacity: 1, scale: 1 } : {}} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22, delay: intro.current ? 1.8 : 0.35 }} style={{ transformOrigin: `${x(end.year)}px ${y(end.value)}px` }}>
          <circle cx={x(end.year)} cy={y(end.value)} r={detailed ? 5 : 4} className="fchart-end" />
          <text x={x(end.year) + 8} y={y(end.value) + 4} className="fchart-endval">{fmt(end.value)}</text>
        </motion.g>
        {/* axes: years below; values on the left when detailed */}
        {xTicks.map((v) => <text key={v} x={x(v)} y={height - 4} textAnchor="middle" className="fchart-tick">{v}</text>)}
        {detailed && yTicks.map((v) => <text key={v} x={m.l - 8} y={y(v) + 4} textAnchor="end" className="fchart-tick">{fmt(v)}</text>)}
        {/* hover crosshair */}
        {h && (
          <g className="fchart-cross">
            <line x1={x(h.year)} x2={x(h.year)} y1={m.t} y2={height - m.b} />
            {h.lo !== undefined && <line x1={x(h.year)} x2={x(h.year)} y1={y(h.lo)} y2={y(h.hi ?? h.lo)} className="fchart-range" />}
            <circle cx={x(h.year)} cy={y(h.value)} r={5} />
          </g>
        )}
      </svg>
      {h && (
        <div className="fchart-tip" style={{ left: `${(x(h.year) / width) * 100}%` }} aria-hidden="true">
          <b>{Math.floor(h.year)}</b> <span>{fmt(h.value)} <small>{s.unit}</small></span>
          {h.lo !== undefined && <small className="fchart-tip-range">80% range {fmt(h.lo)} – {fmt(h.hi)}</small>}
          <small className={`fchart-kind fchart-kind-${h.kind}`}>{h.kind}</small>
        </div>
      )}
    </div>
  );
}
