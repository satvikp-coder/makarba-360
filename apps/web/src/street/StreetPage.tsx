import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, Footprints, Pause, Play, Plane, Sun, Sunrise, Sunset, X } from "lucide-react";
import { TOUR, toLocal } from "./tour.js";
import { fetchPlaces, type PublicFeature } from "../api.js";
import type { Light, Mode } from "./StreetScene.js";
import "./street.css";

const StreetScene = lazy(() => import("./StreetScene.js"));

/** Places you can start walking from (?at=<slug>), in local metres. */
const STARTS: Record<string, [number, number]> = {
  "roza-baradari-courtyard": toLocal([72.50525, 22.99292]),
  "roza-food-waiting-edge": toLocal([72.50585, 22.99338]),
  "sarkhej-roza-road-fruit-seller": toLocal([72.5072, 22.99318]),
  "sarkhej-roza-area": toLocal([72.5049, 22.9926]),
};
const MODES: { id: Mode; label: string; icon: typeof Camera; hint: string }[] = [
  { id: "tour", label: "Cinematic", icon: Camera, hint: "A slow film through the Roza and along the road" },
  { id: "walk", label: "Walk", icon: Footprints, hint: "Drag to look; W A S D or the arrow keys to walk; Shift to hurry" },
  { id: "drone", label: "Drone", icon: Plane, hint: "Drag to orbit, scroll to zoom" },
];
const LIGHTS: { id: Light; label: string; icon: typeof Sun }[] = [
  { id: "morning", label: "Morning", icon: Sunrise }, { id: "noon", label: "Noon", icon: Sun }, { id: "golden", label: "Golden hour", icon: Sunset },
];
/** Software WebGL (SwiftShader, llvmpipe) gets the light version: no shadows, ambient occlusion or reflections. */
function detectQuality(): "high" | "low" {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
    const d = gl?.getExtension("WEBGL_debug_renderer_info");
    const r = d ? String(gl!.getParameter(d.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software|basic render/i.test(r) || !gl ? "low" : "high";
  } catch { return "low"; }
}
/** The first coordinate of any published geometry (point, line or area), as a walking start a few metres back from the place. */
export function startFor(f: PublicFeature): [number, number] | undefined {
  let c: unknown = f.geometry.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  if (!Array.isArray(c) || typeof c[0] !== "number") return undefined;
  const [x, z] = toLocal([c[0] as number, c[1] as number]);
  return [x, z + 12];   // 12 m south of the place, looking north at it
}
const shotAt = (u: number) => u * (TOUR.length - 1);

export function StreetPage() {
  const [params] = useSearchParams();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>((params.get("mode") as Mode) || "tour");
  const [light, setLight] = useState<Light>("golden");
  const [quality, setQuality] = useState<"high" | "low">(() => detectQuality());
  const [playing, setPlaying] = useState(!reduce);
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState<number | null>(null);
  const progress = useRef(0), seek = useRef<number | null>(null), bar = useRef<HTMLDivElement>(null);
  const at = params.get("at") ?? "";
  const [found, setFound] = useState<[number, number] | undefined>();
  useEffect(() => {
    if (!at || STARTS[at]) return;
    const ac = new AbortController();
    fetchPlaces(ac.signal).then((r) => { if (r.status === "ok") { const f = r.features.find((x) => x.properties.slug === at); if (f) setFound(startFor(f)); } });
    return () => ac.abort();
  }, [at]);
  const start = STARTS[at] ?? found;
  useEffect(() => { if (params.get("at")) setMode("walk"); }, [params]);
  // the timeline and captions follow the scene without re-rendering every frame: the bar is styled directly, and React only hears
  // about a caption when it changes
  useEffect(() => {
    let raf = 0, last: number | null = -1;
    const tick = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${progress.current})`;
      const s = shotAt(progress.current), i = TOUR.findIndex((x, k) => x.caption && Math.abs(s - k) < 0.55);
      const next = i >= 0 ? i : null;
      if (next !== last) { last = next; setCaption(next); }
      if (progress.current >= 1 && playing) setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  // keyboard: Space plays or pauses the film; 1 2 3 switch modes; Escape returns to the map
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (e.code === "Space" && mode !== "walk") { e.preventDefault(); setPlaying((p) => { if (!p && progress.current >= 1) seek.current = 0; return !p; }); }
      else if (e.key === "1") setMode("tour"); else if (e.key === "2") setMode("walk"); else if (e.key === "3") setMode("drone");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [mode]);
  const ticks = useMemo(() => TOUR.map((s, k) => ({ k, s })).filter(({ s }) => s.caption), []);
  const shot = caption !== null ? TOUR[caption] : null;
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <section className="street" aria-labelledby="street-h">
      <h1 id="street-h" className="visually-hidden">Street view of Makarba</h1>
      <div className="street-stage" role="img" aria-label="Street-level 3D view of the Sarkhej Roza area: people, traffic, the Roza and the tank">
        <Suspense fallback={null}>
          <StreetScene mode={mode} light={light} quality={quality} playing={playing} progress={progress} seek={seek} start={start}
            onReady={() => setReady(true)} onQuality={setQuality} />
        </Suspense>
      </div>

      {/* loading: a hairline draws across while the streets are built, then the veil lifts */}
      <AnimatePresence>
        {!ready && (
          <motion.div className="street-loading" role="status" aria-live="polite" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.9, ease } }}>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>Building the streets of Makarba…</motion.p>
            <span className="street-loading-line"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 0.92 }} transition={{ duration: 6, ease: [0.1, 0.6, 0.2, 1] }} /></span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chrome appears one piece at a time, only once the scene is ready */}
      <AnimatePresence>
        {ready && (
          <motion.div className="street-ui" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } } }}>
            <motion.div className="street-top glass" variants={{ hidden: { opacity: 0, y: -12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}>
              <div className="street-modes" role="radiogroup" aria-label="Camera">
                {MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} data-tip={m.hint} onClick={() => setMode(m.id)}>
                    {mode === m.id && <motion.span layoutId="street-mode-pill" className="street-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <m.icon size={16} strokeWidth={1.9} aria-hidden="true" /><span>{m.label}</span>
                  </button>
                ))}
              </div>
              <span className="street-sep" aria-hidden="true" />
              <div className="street-modes" role="radiogroup" aria-label="Time of day">
                {LIGHTS.map((l) => (
                  <button key={l.id} type="button" role="radio" aria-checked={light === l.id} aria-label={l.label} data-tip={l.label} onClick={() => setLight(l.id)}>
                    {light === l.id && <motion.span layoutId="street-light-pill" className="street-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <l.icon size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <Link className="street-exit" to="/explore" aria-label="Back to the map" data-tip="Back to the map (Esc)"><X size={18} strokeWidth={2} aria-hidden="true" /></Link>
            </motion.div>

            {mode === "tour" && (
              <motion.div className="street-timeline glass" variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}>
                <button type="button" className="street-play" aria-label={playing ? "Pause the film" : "Play the film"} onClick={() => { if (!playing && progress.current >= 1) seek.current = 0; setPlaying(!playing); }}>
                  {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                </button>
                <div className="street-track" role="slider" tabIndex={0} aria-label="Film position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.current * 100)}
                  onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek.current = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }}
                  onKeyDown={(e) => { const d = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0; if (d) { e.preventDefault(); seek.current = Math.max(0, Math.min(1, progress.current + d)); } }}>
                  <div className="street-fill" ref={bar} />
                  {ticks.map(({ k, s }) => {
                    const u = k / (TOUR.length - 1);
                    return <button key={k} type="button" className="street-tick" style={{ left: `${u * 100}%` }} aria-label={`Jump to ${s.caption}`} data-tip={s.caption} onPointerDown={(e) => e.stopPropagation()} onClick={() => { seek.current = u; setPlaying(true); }} />;
                  })}
                </div>
              </motion.div>
            )}
            {mode === "walk" && (
              <motion.div className="street-help glass" variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}>
                <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · drag to look · <kbd>Shift</kbd> hurry</p>
                <div className="street-pad" aria-label="Walk">
                  {[["Forward", 1.5, 0, "↑"], ["Left", 0, -1.5, "←"], ["Back", -1.5, 0, "↓"], ["Right", 0, 1.5, "→"]].map(([label, f, r, ch]) => (
                    <button key={label as string} type="button" aria-label={`Step ${String(label).toLowerCase()}`} onClick={() => (window as unknown as { __walk?: (f: number, r: number) => void }).__walk?.(f as number, r as number)}>{ch}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* chapter captions: kicker, title and a hairline that draws, revealed in sequence, one chapter at a time */}
      <AnimatePresence mode="wait">
        {ready && mode === "tour" && shot && (
          <motion.div key={caption} className="street-caption" aria-live="polite" initial="hidden" animate="show" exit={{ opacity: 0, y: -10, transition: { duration: 0.5, ease } }}
            variants={{ show: { transition: { staggerChildren: 0.18 } } }}>
            <motion.p className="eyebrow" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}>Chapter {ticks.findIndex((t) => t.k === caption) + 1} of {ticks.length}</motion.p>
            <motion.h2 variants={{ hidden: { opacity: 0, y: 16, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease } } }}>{shot.caption}</motion.h2>
            <motion.span className="street-hairline" variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 1.1, ease } } }} />
            {shot.sub && <motion.p className="street-sub" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease } } }}>{shot.sub}</motion.p>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
export default StreetPage;
