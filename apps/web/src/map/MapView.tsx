import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import * as maplibregl from "maplibre-gl";
// maplibre-gl 6 finds its worker next to its own module, which no longer exists once the app is bundled, so the worker file is
// emitted as an asset and its URL is given explicitly (verified against the production build in the browser tests).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl(workerUrl);
import type { PublicFeature } from "../api.js";
import { categoryColor, categoryColorExpression, CATEGORY_STYLE, scenarioColors } from "../categories.js";
import { makeVehicles, step as stepTraffic, toFeatures } from "./traffic.js";
import { plainKey } from "../Shell.js";
import { getPrefs } from "../prefs.js";
import { AirParticles } from "./AirParticles.js";

/** Fine detail costs a lot on software WebGL (SwiftShader, llvmpipe) and very weak devices; "auto" turns it down there. */
const DETAIL_LAYERS = ["ledges", "shadows", "furniture", "tree-trunk", "zebra", "lane-marking", "ground-grain", "roofs"];
/** Sources whose geometry is dropped (not just hidden) in low detail, so the worker does not parse and index it at all. */
const preloading = () => typeof document !== "undefined" && document.documentElement.dataset.preloading === "1";
const detailData = (): Record<string, unknown> => ({ ledges: city().ledges, shadows: city().shadows, furniture: furniture.solid, markings: furniture.flat, "tree-trunk": city().trees.trunks, roofs: city().roofs });
const EMPTY = { type: "FeatureCollection", features: [] };
export function lowDetail(canvas: HTMLCanvasElement | undefined, detail = getPrefs().detail): boolean {
  if (detail !== "auto") return detail === "low";
  if (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 2) return true;
  try {
    const gl = (canvas?.getContext("webgl2") ?? canvas?.getContext("webgl")) as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const r = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software|basic render/i.test(r);
  } catch { return false; }
}
import { easeInOutSine as easeInOutCubic, useReducedMotion } from "../motion.js";
import type { Scenario } from "../scenario.js";
import { Icon, type IconName } from "../Icon.js";
import { city, furniture, canal, roads, water, CANAL, HIGHWAY, BASE_LABELS, BASEMAP_ATTRIBUTION, buildOfflineStyle, DASH_STEPS, MAKARBA_BOUNDS, MAKARBA_CENTER, THEMES, themedPaint, type Pos, type TimeOfDay } from "./basemap.js";
import { Fallback2D } from "./Fallback2D.js";
import { TOUR } from "./tour.js";
import { footprintAt, footprintData, footprintOf, type Footprint } from "./highlight.js";

const SRC = "places";
/** Camera of the finished intro: Makarba seen from the south-west at a 3D angle. */
export const HOME_VIEW = { center: MAKARBA_CENTER, zoom: 15.25, pitch: 58, bearing: -24 } as const;
const START_VIEW = { center: [72.5035, 22.986] as Pos, zoom: 13.3, pitch: 0, bearing: -70 };
const LABEL_MIN_ZOOM = 14.6;

/** The style is built entirely from local data: no tile, glyph, sprite or font URL. Exported for tests. */
export const buildStyle = buildOfflineStyle;

/** Bounding box [[w,s],[e,n]] of all coordinates, or null when there are none. */
export function boundsOf(features: PublicFeature[]): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  features.forEach((f) => walk(f.geometry.coordinates));
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** A representative point for a feature: the point itself, the middle vertex of a route, the centre of an area. */
export function anchorOf(f: PublicFeature): Pos | null {
  const g = f.geometry;
  if (g.type === "Point") return g.coordinates as Pos;
  if (g.type === "MultiLineString" || g.type === "LineString") {
    const line = (g.type === "LineString" ? g.coordinates : (g.coordinates as Pos[][])[0]) as Pos[] | undefined;
    return line?.length ? line[Math.floor(line.length / 2)]! : null;
  }
  const b = boundsOf([f]);
  return b ? [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2] : null;
}

export const nameOf = (f: PublicFeature): string => {
  const n = f.properties.name;
  if (typeof n === "string") return n;
  const r = (n ?? {}) as Record<string, string>;
  return r["en"] ?? Object.values(r)[0] ?? f.properties.slug;
};

export type MapStatus = "loading" | "ready" | "unavailable";

interface Props {
  features: PublicFeature[];
  sourceAttribution: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onStatus?: (s: MapStatus) => void;
  /** Forecast scene: restyles buildings, haze and traffic. null = today's sketch. */
  scenario?: Scenario | null;
  /** Highlights to pin and visit (AI-generated or rule-based); defaults to the scenario's changes. */
  highlights?: { id: string; title: string; at: [number, number]; tone?: string }[] | null;
  /** Called with the scenario change the guided camera is showing (null when it stops). */
  onFocusChange?: (id: string | null) => void;
  /** Data lens: restyles the scene to show one kind of data in 3D. level is 0..1 for the chosen year. */
  lens?: "places" | "heat" | "air" | "growth" | "mobility";
  lensLevel?: number;
  /** A panel asked the camera to fly here. */
  flyTo?: [number, number] | null;
  /** Width of the floating panel over the map's left edge: the camera centres in the visible part. */
  padLeft?: number;
}

/** Overview that shows the highway corridor and the old village together, used when a scenario is first shown. */
const SCENARIO_VIEW = { center: [72.5105, 22.9935] as Pos, zoom: 15.1, pitch: 64, bearing: -38 };

const LIGHTS: { id: TimeOfDay; label: string; icon: IconName }[] = [{ id: "dawn", label: "Dawn", icon: "sunrise" }, { id: "day", label: "Day", icon: "sun" }, { id: "dusk", label: "Dusk", icon: "sunset" }, { id: "night", label: "Night", icon: "moon" }];
interface TourStopView { id: string; placeId?: string; title: string; caption: string; kicker?: string; source?: string; center: Pos; zoom: number; pitch: number; bearing: number }
const metresBetween = (a: Pos, b: Pos) => Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((23 * Math.PI) / 180), (a[1] - b[1]) * 111_320);
const ORBIT_DEG_PER_MS = 360 / 150_000;   // one slow turn every 2.5 minutes
const ORBIT_IDLE_MS = 3000;
const GUIDE_FLY_MS = 3200, GUIDE_HOLD_MS = 4200;

function el(className: string, text?: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  d.setAttribute("aria-hidden", "true");     // decorative duplicate of information in the page's list; never focusable
  if (text) d.textContent = text;
  return d;
}

/**
 * Offline 3D map of the illustrative Makarba demo. Presentational: it shows already-validated, published public features and never
 * reads private data. Any initialisation failure or WebGL context loss switches to a 2D drawing plus the page's list, which carries
 * the same information. Motion (intro flight, flowing canal and traffic, pulsing selection) honours prefers-reduced-motion and can be
 * paused at any time (WCAG 2.2.2).
 */
export function MapView({ features, sourceAttribution, selectedId, onSelect, onStatus, scenario = null, highlights = null, onFocusChange, lens = "places", lensLevel = 0, flyTo = null, padLeft = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const labelsRef = useRef<maplibregl.Marker[]>([]);
  const pulseRef = useRef<maplibregl.Marker | null>(null);
  const firstData = useRef(true);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const [status, setStatus] = useState<MapStatus>("loading");
  const [rendered, setRendered] = useState(false);
  const [time, setTime] = useState<TimeOfDay>("day");
  const compassRef = useRef<HTMLSpanElement>(null);
  const [cam, setCam] = useState<{ bearing: number; pitch: number; zoom: number; lat: number }>({ bearing: HOME_VIEW.bearing, pitch: HOME_VIEW.pitch, zoom: HOME_VIEW.zoom, lat: MAKARBA_CENTER[1] });
  const [full, setFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [is3d, setIs3d] = useState(true);
  const [paused, setPaused] = useState(reduced);
  const [intro, setIntro] = useState<"pending" | "flying" | "done">("pending");
  const [tour, setTour] = useState<number | null>(null);
  // The tour visits the authored landmark stops, then every published place.
  // A place within ~150 m of an authored stop is part of that stop (its "Open details"), not a second stop at the same spot.
  const authored: TourStopView[] = TOUR.map((t) => ({ id: t.id, title: t.title, caption: t.caption, source: t.source, center: t.center, zoom: t.zoom, pitch: t.pitch, bearing: t.bearing }));
  const placeStops: TourStopView[] = [];
  for (const f of features) {
    const at = anchorOf(f);
    if (!at) continue;
    const near = authored.filter((t) => t.id !== "overview" && !t.placeId && metresBetween(t.center, at) < 150)
      .sort((a, b) => metresBetween(a.center, at) - metresBetween(b.center, at))[0];
    if (near) { near.placeId = String(f.id); continue; }
    const label = CATEGORY_STYLE[f.properties.category as keyof typeof CATEGORY_STYLE]?.label ?? f.properties.category;
    placeStops.push({ id: `place-${String(f.id)}`, placeId: String(f.id), title: nameOf(f), caption: "", kicker: label, center: at, zoom: 17.2, pitch: 62, bearing: NaN });
  }
  const tourStops: TourStopView[] = [...authored, ...placeStops];
  const stopsRef = useRef(tourStops);
  stopsRef.current = tourStops;
  const tourPanel = useRef<HTMLDivElement>(null);
  const report = (s: MapStatus) => { setStatus(s); onStatus?.(s); };
  useEffect(() => { if (reduced) setPaused(true); }, [reduced]);

  const flyHome = (animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const view = { ...HOME_VIEW, pitch: is3d ? HOME_VIEW.pitch : 0, padding: { left: padRef.current, right: 0, top: 0, bottom: 0 } };
    // while the particle preloader plays, it is the intro: the map waits at home for the particles to land on its roads
    if (!animate || reducedRef.current || preloading()) { map.jumpTo(view); setIntro("done"); return; }
    setIntro("flying");
    map.flyTo({ ...view, duration: 4200, curve: 1.25, essential: true, easing: easeInOutCubic });
    map.once("moveend", () => setIntro("done"));
  };

  useEffect(() => {
    if (!host.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: host.current, style: buildStyle("day"), ...(reducedRef.current ? HOME_VIEW : START_VIEW),
        // the map is the whole page now, so plain scroll/drag gestures belong to it; resolution is capped for smooth frames on
        // high-density screens (the visual difference above 1.5x is small, the cost is large)
        attributionControl: false, cooperativeGestures: false, maxPitch: 70, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        maxBounds: [[MAKARBA_BOUNDS[0][0] - 0.03, MAKARBA_BOUNDS[0][1] - 0.03], [MAKARBA_BOUNDS[1][0] + 0.03, MAKARBA_BOUNDS[1][1] + 0.03]],
        canvasContextAttributes: { antialias: true },
      });
    } catch {
      report("unavailable");
      return;
    }
    mapRef.current = map;
    // Our own controls replace MapLibre's defaults. During a move only the compass needle turns (straight on the DOM, no React
    // render per frame: re-rendering the whole map UI 60 times a second was the main cause of stutter in flights and the 360° turn);
    // the rest of the camera mirror (scale bar, tilt button, stars) updates when the move ends.
    const syncCam = () => setCam({ bearing: map.getBearing(), pitch: map.getPitch(), zoom: map.getZoom(), lat: map.getCenter?.().lat ?? MAKARBA_CENTER[1] });
    map.on("move", () => { const n = compassRef.current; if (n) n.style.transform = `rotate(${-map.getBearing()}deg)`; });
    map.on("moveend", syncCam);
    const lost = () => report("unavailable");
    map.getCanvas().addEventListener("webglcontextlost", lost);
    map.on("error", (e: { error?: { message?: string } }) => {
      if (/webgl|context/i.test(e.error?.message ?? "")) lost();
      else if (import.meta.env.DEV) console.warn("map:", e.error?.message);
    });
    const zoomClass = () => host.current?.parentElement?.classList.toggle("labels-far", map.getZoom() < LABEL_MIN_ZOOM);
    map.on("zoom", zoomClass);
    // Ground grain for the "ground-grain" layer, generated on the fly (no image file, nothing fetched).
    map.on("styleimagemissing", (e: { id?: string }) => {
      if (e.id !== "grain" || map.hasImage?.("grain")) return;
      const n = 96, px = new Uint8Array(n * n * 4);
      let seed = 1337;
      for (let i = 0; i < n * n; i++) {
        seed = (seed * 16807) % 2147483647;
        const v = seed % 255, dark = v < 128;
        px.set([dark ? 70 : 255, dark ? 62 : 250, dark ? 50 : 240, Math.round((v % 64) / 64 * (dark ? 34 : 22))], i * 4);
      }
      map.addImage?.("grain", { width: n, height: n, data: px });
    });
    map.on("load", () => {
      // Only published, contract-validated features are ever added. Clustering applies to points only.
      map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
      const isPoint = ["all", ["==", ["geometry-type"], "Point"], ["!", ["has", "point_count"]]] as unknown as maplibregl.FilterSpecification;
      const color = categoryColorExpression() as unknown as maplibregl.ExpressionSpecification;
      map.addLayer({ id: "places-fill", type: "fill-extrusion", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-extrusion-color": color, "fill-extrusion-height": 3, "fill-extrusion-opacity": 0.55, "fill-extrusion-height-transition": { duration: 700, delay: 0 } } });
      map.addLayer({ id: "places-line", type: "line", source: SRC, filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 9], "line-opacity": 0.85 } });
      map.addLayer({ id: "places-cluster", type: "circle", source: SRC, filter: ["has", "point_count"], paint: { "circle-color": "#E6BC6C", "circle-stroke-width": 2, "circle-stroke-color": "#163D3B", "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 20, 24] } });
      map.addLayer({ id: "places-point", type: "circle", source: SRC, filter: isPoint, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 11], "circle-color": color, "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff", "circle-pitch-alignment": "map" } });
      // selection highlight: the footprint under the place (see highlight.ts), drawn as a soft glow, a crisp edge and, for a
      // building, the building itself lit in the place's colour
      const none = { type: "FeatureCollection" as const, features: [] };
      map.addSource("focus-lines", { type: "geojson", data: none });
      map.addSource("focus-solid", { type: "geojson", data: none });
      map.addLayer({ id: "focus-ground", type: "fill", source: "focus-solid", filter: ["==", ["get", "kind"], "area"], paint: { "fill-color": ["get", "c"], "fill-opacity": 0.14 } });
      map.addLayer({ id: "focus-extrude", type: "fill-extrusion", source: "focus-solid", filter: ["==", ["get", "kind"], "building"], paint: { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["+", ["get", "h"], 0.6], "fill-extrusion-opacity": 0.92 } });
      map.addLayer({ id: "focus-glow", type: "line", source: "focus-lines", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 14, 8, 18, 22], "line-blur": ["interpolate", ["linear"], ["zoom"], 14, 6, 18, 14], "line-opacity": 0.5 } });
      map.addLayer({ id: "focus-edge", type: "line", source: "focus-lines", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 4] } });
      map.addLayer({ id: "focus-core", type: "line", source: "focus-lines", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 1.4], "line-opacity": 0.9 } });
      const pick = (e: { features?: { properties?: Record<string, unknown> }[] }) => {
        const id = e.features?.[0]?.properties?.["locationId"];
        if (typeof id === "string") onSelectRef.current?.(id);
      };
      map.on("click", "places-point", pick);
      map.on("click", "places-fill", pick);
      map.on("click", "places-line", pick);
      map.on("click", "places-cluster", (e: { features?: { properties?: Record<string, unknown> }[]; lngLat?: { lng: number; lat: number } }) => {
        const cid = e.features?.[0]?.properties?.["cluster_id"];
        const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
        if (typeof cid !== "number" || !e.lngLat) return;
        src.getClusterExpansionZoom(cid).then((zoom: number) => map.easeTo({ center: [e.lngLat!.lng, e.lngLat!.lat], zoom, duration: reducedRef.current ? 0 : 600 }));
      });
      for (const pt of ["places-point", "places-fill", "places-line"]) {
        map.on("mouseenter", pt, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", pt, () => { map.getCanvas().style.cursor = ""; });
      }
      try { map.setSky?.(THEMES.day.sky as maplibregl.SkySpecification); } catch { /* sky is decoration only */ }
      for (const l of BASE_LABELS) {
        labelsRef.current.push(new maplibregl.Marker({ element: el(`map-label map-label--${l.kind}`, l.text), anchor: "center" }).setLngLat(l.at).addTo(map));
      }
      zoomClass();
      // First frame drawn with all source data in place. Not "idle" or loaded(): the ambient animation changes paint properties
      // several times a second, which marks the style dirty, so on slow (software-rendered) devices those may never report true.
      const drawn = () => (typeof map.areTilesLoaded === "function" ? map.areTilesLoaded() : typeof map.loaded !== "function" || map.loaded());
      const onRender = () => { if (drawn()) { setRendered(true); map.off?.("render", onRender); } };
      map.on("render", onRender);
      report("ready");
    });
    return () => {
      map.getCanvas().removeEventListener("webglcontextlost", lost);
      map.remove(); mapRef.current = null; labelsRef.current = []; pulseRef.current = null; firstData.current = true;
    };
  }, [sourceAttribution]);

  // Published places: data, HTML name labels, and the camera (intro flight on first data, gentle refit on later filter changes).
  const padRef = useRef(padLeft);
  padRef.current = padLeft;
  const placeLabels = useRef<maplibregl.Marker[]>([]);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId ?? null;
  // Parents rebuild the features array on every render; only a change in WHICH places are shown should move the camera.
  const featKey = features.map((f) => String(f.id)).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: features as unknown as never[] });
    placeLabels.current.forEach((m) => m.remove());
    placeLabels.current = features.flatMap((f) => {
      const at = anchorOf(f);
      if (!at) return [];
      const d = el("map-label map-label--place");
      const dot = document.createElement("i"); const txt = document.createElement("span"); txt.textContent = nameOf(f);
      d.append(dot, txt);
      d.style.setProperty("--c", categoryColor(f.properties.category));
      d.dataset.id = String(f.id);
      d.classList.toggle("on", String(f.id) === selectedRef.current);
      d.addEventListener("click", () => onSelectRef.current?.(String(f.id)));
      return [new maplibregl.Marker({ element: d, anchor: "bottom", offset: [0, -12] }).setLngLat(at).addTo(map)];
    });
    if (firstData.current) {
      firstData.current = false;
      flyHome(true);
      return;
    }
    const box = boundsOf(features);
    if (box) map.fitBounds(box, { padding: 64, maxZoom: 16.4, pitch: map.getPitch(), bearing: map.getBearing(), duration: reducedRef.current ? 0 : 1100 });
    // flyHome is stable for this purpose; features/status drive the update
    // featKey stands in for features (same places = same key)
  }, [featKey, status]);

  // Selection: highlight colour/extrusion, a pulsing ring, and a flight to the place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("places-point")) return;
    const sel = (a: unknown, b: unknown) => (selectedId ? ["case", ["==", ["get", "locationId"], selectedId], a, b] : b) as never;
    map.setPaintProperty("places-point", "circle-radius", sel(9, ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 11]));
    map.setPaintProperty("places-point", "circle-stroke-color", sel("#163D3B", "#ffffff"));
    map.setPaintProperty("places-fill", "fill-extrusion-height", sel(4, 3));
    map.setPaintProperty("places-line", "line-width", sel(["interpolate", ["linear"], ["zoom"], 13, 4, 17, 11], ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 9]));
    pulseRef.current?.remove();
    pulseRef.current = null;
    for (const m of placeLabels.current) m.getElement().classList.toggle("on", m.getElement().dataset.id === selectedId);
    const f = selectedId ? features.find((x) => String(x.id) === selectedId) : undefined;
    const at = f ? anchorOf(f) : null;
    if (!f || !at) return;
    const ring = el("map-pulse");
    ring.style.setProperty("--c", categoryColor(f.properties.category));
    ring.appendChild(document.createElement("span"));
    pulseRef.current = new maplibregl.Marker({ element: ring, anchor: "center" }).setLngLat(at).addTo(map);
    const view = { center: at, zoom: Math.max(map.getZoom(), 16.2), pitch: is3d ? 62 : 0, bearing: map.getBearing() };
    if (reducedRef.current) map.jumpTo(view);
    else map.flyTo({ ...view, speed: 0.9, curve: 1.35, maxDuration: 3000, easing: easeInOutCubic, essential: true });
    // the camera should move only when the selection changes, not when the 3D toggle does
  }, [selectedId, status, featKey]);

  // The preloader's particles land on the roads as drawn: tell it where they are on screen once the first full frame is in.
  useEffect(() => {
    const map = mapRef.current;
    if (!rendered || !map || !preloading()) return;
    const rect = map.getCanvas().getBoundingClientRect();
    const lines = [...roads.features, ...canal.features, ...water.features].map((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]! : f.geometry.coordinates) as Pos[]);
    const px = lines.map((l) => l.map((p) => { const q = map.project(p); return [q.x + rect.left, q.y + rect.top] as [number, number]; }));
    document.dispatchEvent(new CustomEvent("makarba:map-ready", { detail: px }));
  }, [rendered]);

  // Declutter: place labels that would overlap one already shown are hidden until there is room (the selected place's wins).
  // Throttled, since the 360° turn moves the camera every frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    let t = 0, last = 0;
    const run = () => {
      last = performance.now();
      const els = placeLabels.current.map((m) => m.getElement()).sort((a, b) => Number(b.classList.contains("on")) - Number(a.classList.contains("on")));
      for (const el of els) el.classList.remove("overlap");
      const kept: DOMRect[] = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        if (kept.some((k) => r.left < k.right + 6 && r.right > k.left - 6 && r.top < k.bottom + 3 && r.bottom > k.top - 3)) el.classList.add("overlap");
        else kept.push(r);
      }
    };
    const soon = () => { clearTimeout(t); const wait = Math.max(0, 250 - (performance.now() - last)); t = window.setTimeout(run, wait); };
    map.on("moveend", soon);
    soon();
    return () => { clearTimeout(t); map.off("moveend", soon); };
  }, [status, featKey, selectedId]);

  // The outline: the current tour stop (its place, or the landmark area it looks at), else the selected place.
  const focusKey = `${tour ?? ""}|${selectedId ?? ""}|${featKey}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getSource("focus-lines")) return;
    const stop = tour !== null ? stopsRef.current[Math.min(tour, stopsRef.current.length - 1)] : undefined;
    const placeId = stop ? stop.placeId : selectedId ?? undefined;
    const f = placeId ? features.find((x) => String(x.id) === placeId) : undefined;
    let fp: Footprint | null = null, color = "#E6BC6C";
    if (f) { fp = footprintOf(f, city().buildings); color = categoryColor(f.properties.category); }
    else if (stop) {
      const line = ({ highway: HIGHWAY, canal: CANAL } as Record<string, Pos[]>)[stop.id];
      const a = footprintAt(stop.center, null);
      fp = line ? { kind: "route", rings: [line], height: 0 } : a.kind === "area" ? a : null;   // never an arbitrary building
    }
    const d = footprintData(fp, color);
    (map.getSource("focus-lines") as maplibregl.GeoJSONSource).setData(d.lines as never);
    (map.getSource("focus-solid") as maplibregl.GeoJSONSource).setData(d.solid as never);
  }, [focusKey, status]);

  // Colour-blind-safe palette: WebGL layers are recoloured when the display setting changes.
  const [paletteTick, setPaletteTick] = useState(0);
  useEffect(() => {
    const on = () => setPaletteTick((n) => n + 1);
    window.addEventListener("prefs-change", on);
    return () => window.removeEventListener("prefs-change", on);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("places-point") || !paletteTick) return;
    const color = categoryColorExpression() as never;
    map.setPaintProperty("places-point", "circle-color", color);
    map.setPaintProperty("places-line", "line-color", color);
    map.setPaintProperty("places-fill", "fill-extrusion-color", color);
  }, [paletteTick, status]);

  // Time-of-day lighting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const t = THEMES[time];
    for (const [layer, paint] of Object.entries(themedPaint(t))) {
      if (!map.getLayer(layer)) continue;
      for (const [k, v] of Object.entries(paint)) map.setPaintProperty(layer, k as never, v as never);
    }
    map.setLight(t.light);
    try { map.setSky?.(t.sky as maplibregl.SkySpecification); } catch { /* decoration only */ }
  }, [time, status]);

  // Guided story tour: one flight per stop, advanced only by the visitor.
  useEffect(() => {
    const map = mapRef.current;
    if (tour === null || !map || status !== "ready") return;
    const s = stopsRef.current[Math.min(tour, stopsRef.current.length - 1)]!;
    // place stops keep roughly the current heading (a small turn, not a spin to a new bearing); flights are paced by distance
    const bearing = Number.isNaN(s.bearing) ? map.getBearing() + 20 : s.bearing;
    const view = { center: s.center, zoom: s.zoom, pitch: is3d ? s.pitch : 0, bearing };
    if (reducedRef.current) map.jumpTo(view);
    else map.flyTo({ ...view, speed: 0.7, curve: 1.42, maxDuration: 4200, easing: easeInOutCubic, essential: true });
    tourPanel.current?.focus();
  }, [tour, status]);

  // 3D / 2D camera.
  const lastIs3d = useRef(is3d);
  useEffect(() => {
    const map = mapRef.current;
    if (lastIs3d.current === is3d) return;   // only an actual toggle moves the camera (never the intro or a status change)
    lastIs3d.current = is3d;
    if (!map || status !== "ready") return;
    map.easeTo({ pitch: is3d ? HOME_VIEW.pitch : 0, bearing: is3d ? map.getBearing() : 0, duration: reducedRef.current ? 0 : 900 });
  }, [is3d, status]);

  // Ambient motion: flowing canal and traffic. Stopped when paused, under reduced motion and while the tab is hidden, and held until
  // the intro flight has finished so the fly-in gets the full frame budget.
  const flying = intro === "flying";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || paused || flying || typeof requestAnimationFrame !== "function") return;
    let raf = 0, last = 0, step = 0;
    const n = DASH_STEPS.length;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || (map.isMoving?.() && !spinRef.current) || now - last < 85 / trafficRef.current) return;
      last = now;
      step = (step + 1) % n;
      map.setPaintProperty("canal-flow", "line-dasharray", DASH_STEPS[step]);
      map.setPaintProperty("traffic-a", "line-dasharray", DASH_STEPS[step]);
      map.setPaintProperty("traffic-b", "line-dasharray", DASH_STEPS[(n - step) % n]);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, paused, flying]);

  // Moving 3D traffic: vehicles drive on the left along the sketch roads; the forecast's traffic factor adds vehicles and slows them.
  const vehiclesRef = useRef(makeVehicles(56));
  const [low, setLow] = useState(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const apply = () => {
      const l = lowDetail(map.getCanvas?.());
      setLow(l);
      for (const id of DETAIL_LAYERS) if (map.getLayer(id)) map.setLayoutProperty?.(id, "visibility", l ? "none" : "visible");
      for (const [id, data] of Object.entries(detailData())) (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData?.((l ? EMPTY : data) as never);
    };
    apply();
    window.addEventListener("prefs-change", apply);
    return () => window.removeEventListener("prefs-change", apply);
  }, [status]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const want = Math.min(150, Math.round((low ? 22 : 56) * (scenario?.traffic ?? 1)));
    if (vehiclesRef.current.length !== want) vehiclesRef.current = makeVehicles(want);
    const draw = () => {
      const f = toFeatures(vehiclesRef.current);
      (map.getSource("vehicles") as maplibregl.GeoJSONSource | undefined)?.setData?.(f.bodies as never);
      (map.getSource("vehicle-lights") as maplibregl.GeoJSONSource | undefined)?.setData?.(f.lights as never);
    };
    draw();
    // start moving only once the map has fully drawn and the intro flight is over: constant source updates before that would keep
    // the "all tiles loaded" moment from ever arriving on slow (software-rendered) devices
    if (paused || !rendered || flying || typeof requestAnimationFrame !== "function") return;
    let raf = 0, last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // ~18 fps is smooth for small vehicles; frozen while the camera moves so flights keep the whole frame budget
      const flight = map.isMoving?.() && !spinRef.current;
      if (document.hidden || flight || now - last < (low ? 110 : 55)) { if (flight) last = now; return; }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.04;
      last = now;
      stepTraffic(vehiclesRef.current, dt, scenario?.traffic ?? 1);
      draw();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, paused, scenario?.traffic, rendered, flying, low]);

  // 360° camera, on by default: after a few seconds with no input (also at each tour stop) the camera starts a slow, continuous turn
  // around what is in view, easing in. Any touch, scroll, drag or key stops it, and it re-arms itself; selections, tour stops and
  // highlight flights take over the camera and it resumes once they have settled. Off under reduced motion.
  const [orbit, setOrbitState] = useState(!reduced);
  const orbitChosen = useRef(false);
  const setOrbit = (on: boolean) => { orbitChosen.current = true; setOrbitState(on); };
  // software-rendered maps (Low detail) start with it off: a camera that never rests costs every frame there
  useEffect(() => { if (low && !orbitChosen.current) setOrbitState(false); }, [low]);
  const spinRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!orbit || !map || status !== "ready" || reducedRef.current || typeof requestAnimationFrame !== "function") return;
    let raf = 0, idle = 0, t0 = 0, last = 0, ours = false;
    const spin = (now: number) => {
      raf = requestAnimationFrame(spin);
      if (document.hidden) { last = 0; return; }
      t0 ||= now;
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      ours = true;
      map.setBearing(map.getBearing() + dt * ORBIT_DEG_PER_MS * Math.min(1, (now - t0) / 2200) ** 2);   // eases in over ~2 s
      ours = false;
    };
    const start = () => {
      if (spinRef.current) return;
      if (map.isMoving()) { arm(); return; }   // a flight is still settling
      spinRef.current = true; t0 = 0; last = 0; raf = requestAnimationFrame(spin);
    };
    const halt = () => { if (spinRef.current) { spinRef.current = false; cancelAnimationFrame(raf); } };
    const arm = () => { clearTimeout(idle); idle = window.setTimeout(start, ORBIT_IDLE_MS); };
    const input = () => { halt(); arm(); };
    const c = map.getCanvasContainer?.();
    c?.addEventListener("pointerdown", input); c?.addEventListener("wheel", input, { passive: true }); c?.addEventListener("touchstart", input, { passive: true });
    window.addEventListener("keydown", input);
    // any camera move the turn did not make (a selection, tour stop or highlight flight) takes over; the turn waits for it to settle
    const other = () => { if (!ours) input(); };
    map.on("movestart", other);
    arm();
    return () => {
      halt(); clearTimeout(idle);
      c?.removeEventListener("pointerdown", input); c?.removeEventListener("wheel", input); c?.removeEventListener("touchstart", input);
      window.removeEventListener("keydown", input);
      map.off("movestart", other);
    };
  }, [orbit, status]);


  // Forecast scenario: building heights/colours animate via style transitions; haze is a CSS overlay; traffic speeds up.
  const trafficRef = useRef(1);
  trafficRef.current = scenario?.traffic ?? 1;
  const hadScenario = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("buildings")) return;
    const base = (themedPaint(THEMES[time])["buildings"] ?? {})["fill-extrusion-color"];
    const sc = scenario;
    const isNew: unknown = sc ? ["all", ["<", ["coalesce", ["get", "r"], 1], sc.redevelop], ["!=", ["get", "zone"], "village"], ["!=", ["get", "zone"], "mill"]] : false;
    const factor: unknown = !sc ? 1 : ["*",
      ["match", ["get", "zone"], "corridor", sc.corridorGrowth, "village", 1, "mill", 1, sc.densify],
      ["case", isNew, 1.9, 1]];
    map.setPaintProperty("buildings", "fill-extrusion-height-transition" as never, { duration: reducedRef.current ? 0 : 1800, delay: 0 } as never);
    map.setPaintProperty("buildings", "fill-extrusion-color-transition" as never, { duration: reducedRef.current ? 0 : 1200, delay: 0 } as never);
    map.setPaintProperty("buildings", "fill-extrusion-height", ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["*", ["get", "h"], factor]] as never);
    const sco = scenarioColors();
    map.setPaintProperty("buildings", "fill-extrusion-color", (!sc ? base : ["case", isNew, sco.rebuilt, base]) as never);
    if (map.getLayer("roofs")) {
      // rooftop rooms and tanks ride on the building below; solar roofs replace tanks with blue panels
      const roofBase = ["*", ["get", "h"], factor];
      const roofBaseColor = (themedPaint(THEMES[time])["roofs"] ?? {})["fill-extrusion-color"];
      for (const [k, v] of [["fill-extrusion-base-transition", { duration: reducedRef.current ? 0 : 1800, delay: 0 }], ["fill-extrusion-height-transition", { duration: reducedRef.current ? 0 : 1800, delay: 0 }]] as const) map.setPaintProperty("roofs", k as never, v as never);
      map.setPaintProperty("roofs", "fill-extrusion-base", roofBase as never);
      map.setPaintProperty("roofs", "fill-extrusion-height", ["+", roofBase, sc ? ["case", ["all", ["==", ["get", "kind"], "tank"], [">", ["get", "r"], 1 - sc.solar]], 0.4, ["get", "extra"]] : ["get", "extra"]] as never);
      map.setPaintProperty("roofs", "fill-extrusion-color", (sc ? ["case", ["all", ["==", ["get", "kind"], "tank"], [">", ["get", "r"], 1 - sc.solar]], sco.solar, roofBaseColor] : roofBaseColor) as never);
      if (map.getLayer("ledges")) {
        // floor ledges keep their storey as the block grows
        const ledgeBase = ["*", ["*", ["get", "h"], ["get", "f"]], factor];
        map.setPaintProperty("ledges", "fill-extrusion-base", ledgeBase as never);
        map.setPaintProperty("ledges", "fill-extrusion-height", ["+", ledgeBase, 0.35] as never);
      }
    }
    if (sc && !hadScenario.current && tour === null && reducedRef.current) {
      const view = { ...SCENARIO_VIEW, pitch: is3d ? SCENARIO_VIEW.pitch : 0 };
      if (reducedRef.current) map.jumpTo(view);
      else map.flyTo({ ...view, duration: 2600, curve: 1.2, easing: easeInOutCubic, essential: true });
    }
    hadScenario.current = !!sc;
    // camera moves only when a scenario is first switched on, not on every slider step
  }, [scenario, status, time, paletteTick]);

  // Numbered callouts pinned where each change happens; they match the numbered list beside the map.
  const callouts = useRef<maplibregl.Marker[]>([]);
  const hl = scenario ? (highlights ?? scenario.changes) : [];
  const calloutKey = hl.map((c) => `${c.id}:${c.title}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    const clear = () => { for (const m of callouts.current) m.remove(); callouts.current = []; };
    clear();
    if (!map || status !== "ready" || !hl.length) return;
    callouts.current = hl.map((c, i) => {
      const d = el(`map-callout map-callout--${c.id}${"tone" in c && c.tone ? ` tone-${c.tone}` : ""}`);
      const n = document.createElement("b"); n.textContent = String(i + 1);
      const t = document.createElement("span"); t.textContent = c.title;
      d.append(n, t);
      d.style.setProperty("--i", String(i));
      return new maplibregl.Marker({ element: d, anchor: "bottom" }).setLngLat(c.at).addTo(map);
    });
    return clear;
  }, [calloutKey, status]);

  // Guided highlights: in a forecast scene the camera visits each change in turn (round robin) and lights up its callout.
  const [guide, setGuide] = useState(true);
  const [gi, setGi] = useState(0);
  const onFocusRef = useRef(onFocusChange);
  onFocusRef.current = onFocusChange;
  const changesRef = useRef(hl);
  changesRef.current = hl;
  useEffect(() => {
    const map = mapRef.current;
    const list = changesRef.current;
    const mark = (id: string | null) => {
      callouts.current.forEach((m, i) => m.getElement().classList.toggle("on", list[i]?.id === id));
      onFocusRef.current?.(id);
    };
    if (!map || status !== "ready" || !calloutKey || !guide || reduced || tour !== null || !list.length) { mark(null); return; }
    const c = list[gi % list.length]!;
    mark(c.id);
    map.flyTo({ center: c.at, zoom: 16.1, pitch: is3d ? 62 : 0, bearing: -50 + ((gi * 47) % 120), duration: GUIDE_FLY_MS, curve: 1.2, easing: easeInOutCubic, essential: true });
    const t = window.setTimeout(() => setGi((g) => g + 1), GUIDE_FLY_MS + GUIDE_HOLD_MS);
    const stop = () => setGuide(false);
    const el2 = map.getCanvasContainer?.();
    el2?.addEventListener("pointerdown", stop); el2?.addEventListener("wheel", stop, { passive: true });
    return () => { clearTimeout(t); el2?.removeEventListener("pointerdown", stop); el2?.removeEventListener("wheel", stop); };
  }, [gi, guide, calloutKey, status, tour, reduced]);
  useEffect(() => { if (calloutKey) { setGi(0); setGuide(true); } }, [calloutKey]);

  // Map shortcuts (see the shortcut list in Shell.tsx). Arrow keys pan only when the map itself has focus (MapLibre handles that).
  const keys = useRef({ tour, setTour, orbit, setOrbit, guide, setGuide, setGi, setIs3d, setTime, setPaused, flyHome, scenario, n: 0 });
  keys.current = { tour, setTour, orbit, setOrbit, guide, setGuide, setGi, setIs3d, setTime, setPaused, flyHome, scenario, n: 0 };
  const stopsLen = tourStops.length;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const map = mapRef.current;
      if (!map || !plainKey(e) || document.querySelector("dialog[open]")) return;
      const k = keys.current, onMap = (e.target as HTMLElement | null)?.closest?.(".maplibregl-canvas-container, .maplibregl-canvas");
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dur = reducedRef.current ? 0 : 450;
      switch (key) {
        case "t": k.setTour(k.tour === null ? 0 : null); break;
        case "c": if (!reducedRef.current) k.setOrbit(!k.orbit); break;
        case "h": if (k.scenario) k.setGuide(!k.guide); break;
        case "l": k.setTime((t) => LIGHTS[(LIGHTS.findIndex((x) => x.id === t) + 1) % LIGHTS.length]!.id); break;
        case "b": k.setIs3d((v) => !v); break;
        case "m": k.setPaused((v) => !v); break;
        case "r": k.setOrbit(false); k.flyHome(true); break;
        case "+": case "=": map.zoomIn?.({ duration: dur }); break;
        case "-": case "_": map.zoomOut?.({ duration: dur }); break;
        case "q": map.easeTo({ bearing: map.getBearing() - 22.5, duration: dur }); break;
        case "e": map.easeTo({ bearing: map.getBearing() + 22.5, duration: dur }); break;
        case "w": map.easeTo({ pitch: Math.min(70, map.getPitch() + 10), duration: dur }); break;
        case "s": map.easeTo({ pitch: Math.max(0, map.getPitch() - 10), duration: dur }); break;
        case "ArrowRight": case "ArrowLeft": {
          if (onMap) return;   // the focused map pans itself
          const d = key === "ArrowRight" ? 1 : -1;
          if (k.tour !== null) k.setTour(Math.max(0, Math.min(stopsLen - 1, k.tour + d)));
          else if (k.scenario && k.guide) k.setGi((g) => Math.max(0, g + d));
          else return;
          break;
        }
        case "Escape": if (k.tour === null && !(k.scenario && k.guide)) return; k.setTour(null); if (k.scenario) k.setGuide(false); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [stopsLen]);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  // scale bar: a round distance that fits ~90 px at the current zoom and latitude (512 px tiles)
  const mpp = (40075016.686 * Math.cos((cam.lat * Math.PI) / 180)) / (512 * 2 ** cam.zoom);
  const nice = [10, 20, 50, 100, 200, 300, 500, 1000, 2000, 5000].find((m) => m / mpp >= 60) ?? 5000;
  const scalePx = nice / mpp;

  // Data lenses: Growth recolours buildings by height, Mobility colours the main roads by congestion; Heat and Air are overlays below.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("buildings")) return;
    const base = (themedPaint(THEMES[time])["buildings"] ?? {})["fill-extrusion-color"];
    if (lens === "growth") map.setPaintProperty("buildings", "fill-extrusion-color", ["interpolate", ["linear"], ["get", "h"], 3, "#f2e6c9", 12, "#e9b872", 24, "#d27a55", 45, "#9b3d2e"] as never);
    else if (!scenario) map.setPaintProperty("buildings", "fill-extrusion-color", base as never);
    if (map.getLayer("road")) {
      const roadBase = (themedPaint(THEMES[time])["road"] ?? {})["line-color"];
      const heavy = `rgba(214, ${Math.round(110 - 70 * lensLevel)}, 60, 1)`;
      map.setPaintProperty("road", "line-color", (lens === "mobility" ? ["match", ["get", "kind"], "highway", heavy, "arterial", "#e3a052", roadBase] : roadBase) as never);
    }
  }, [lens, lensLevel, status, time, scenario]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const pad = () => map.easeTo({ padding: { left: padLeft, right: 0, top: 0, bottom: 0 }, duration: reducedRef.current ? 0 : 700, easing: easeInOutCubic });
    // a camera move in progress (the intro flight, a fly-to) would be cancelled by easeTo: pad once it settles
    if (!map.isMoving()) { pad(); return; }
    map.once("moveend", pad);
    return () => { map.off("moveend", pad); };
  }, [padLeft, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!flyTo || !map || status !== "ready") return;
    const view = { center: flyTo, zoom: Math.max(map.getZoom(), 16.2), pitch: is3d ? 62 : 0, bearing: map.getBearing() };
    if (reducedRef.current) map.jumpTo(view); else map.flyTo({ ...view, duration: 1800, curve: 1.25, easing: easeInOutCubic, essential: true });
  }, [flyTo, status]);
  const haze = Math.max(scenario?.haze ?? 0, lens === "air" ? 0.12 + lensLevel * 0.5 : 0);
  const heat = lens === "heat" ? 0.2 + lensLevel * 0.6 : scenario && scenario.heat > 0.05 ? 0.25 + scenario.heat * 0.55 : 0;

  const unavailable = status === "unavailable";
  return (
    <div className="map-wrap" ref={wrapRef} data-detail={low ? "low" : "high"} data-full={full ? "true" : "false"} data-map-status={status} data-rendered={rendered ? "true" : "false"} data-motion={reduced ? "reduced" : "full"} data-paused={paused ? "true" : "false"} data-time={time} data-intro={intro}>
      {!unavailable && (
        <div className="map-toolbar" role="group" aria-label="Map view">
          <button type="button" className="tb tb-text" aria-pressed={orbit} disabled={reduced} onClick={() => setOrbit(!orbit)} data-tip={reduced ? "Off while reduced motion is on" : orbit ? "On: the camera turns slowly when you stop interacting (C)" : "Turn the camera slowly when idle (C)"}><Icon name="camera" /><span>360° camera</span></button>
          <button type="button" className="tb tb-text tour-start" aria-pressed={tour !== null} onClick={() => setTour(tour === null ? 0 : null)} aria-label={tour === null ? "Start story tour" : "End story tour"} data-tip="Tour every landmark and place, stop by stop"><Icon name="route" /><span>Tour</span></button>
          {scenario && <button type="button" className="tb tb-text" aria-pressed={guide && !reduced} disabled={reduced} onClick={() => { setGuide(!guide); setTour(null); setOrbit(false); }} data-tip="Camera visits each forecast highlight in turn"><Icon name="spark" /><span>Highlights</span></button>}
          <span className="tb-sep" aria-hidden="true" />
          <button type="button" className="tb" aria-pressed={is3d} onClick={() => setIs3d(!is3d)} aria-label="3D buildings" data-tip="3D buildings"><Icon name="cube" /></button>
          <span className="seg" role="group" aria-label="Lighting">
            {LIGHTS.map((l) => <button key={l.id} type="button" className="tb" aria-pressed={time === l.id} onClick={() => setTime(l.id)} aria-label={l.label} data-tip={l.label}><Icon name={l.icon} /></button>)}
          </span>
          <button type="button" className="tb" aria-pressed={paused} onClick={() => setPaused(!paused)} aria-label={paused ? "Play motion" : "Pause motion"} data-tip={paused ? "Play motion" : "Pause motion"}><Icon name={paused ? "play" : "pause"} /></button>
          <button type="button" className="tb" onClick={() => { setOrbit(false); flyHome(true); }} aria-label="Replay fly-in" data-tip="Replay fly-in"><Icon name="replay" /></button>
        </div>
      )}
      {!unavailable && tour !== null && (() => {
        const s = tourStops[Math.min(tour, tourStops.length - 1)]!;
        const n = tourStops.length;
        return (
          <div className="tour" role="region" aria-label="Story tour" ref={tourPanel} tabIndex={-1} key={s.id}>
            <span className="tour-line" aria-hidden="true" style={{ transform: `scaleX(${(tour + 1) / n})` }} />
            <p className="tour-step">Stop {tour + 1} of {n}{s.kicker ? ` · ${s.kicker}` : ""}</p>
            <h2>{s.title}{s.source && <button type="button" className="tour-src" data-tip={`Source: ${s.source}`} aria-label={`Source: ${s.source}`}><Icon name="info" size={14} /></button>}</h2>
            {s.caption && <p>{s.caption}</p>}
            <div className="tour-nav">
              <button type="button" disabled={tour === 0} onClick={() => setTour(tour - 1)}><Icon name="chevL" size={16} />Previous stop</button>
              {tour < n - 1 ? <button type="button" onClick={() => setTour(tour + 1)}>Next stop<Icon name="chevR" size={16} /></button> : <button type="button" onClick={() => { setTour(null); flyHome(true); }}>Finish tour</button>}
              {s.placeId && <button type="button" onClick={() => onSelectRef.current?.(s.placeId!)}>Open details</button>}
              <button type="button" className="tour-end" onClick={() => setTour(null)} aria-label="End story tour"><Icon name="close" size={16} /></button>
            </div>
          </div>
        );
      })()}
      <div className="map-stage">
        {!unavailable && (time === "night" || time === "dusk") && <div className={`map-stars stars-${time}`} aria-hidden="true" style={{ opacity: Math.max(0, Math.min(1, (cam.pitch - 35) / 25)) }} />}
        {haze > 0 && <div className="map-haze" aria-hidden="true" style={{ opacity: haze }}><i /><i /><i /></div>}
        {heat > 0 && <div className="map-heat" aria-hidden="true" style={{ opacity: heat }} />}
        {lens === "air" && !reduced && <AirParticles level={lensLevel} />}
        {scenario && (
          <div className="scen-hud" aria-hidden="true">
            <span className="scen-year" key={scenario.year}>{scenario.year}</span>
            <ul className="scen-legend">
              <li><i className="sw sw-new" />Rebuilt / new blocks</li>
              <li><i className="sw sw-solar" />Rooftop solar</li>
              <li><i className="sw sw-tall" />Taller = growth</li>
              <li><i className="sw sw-haze" />Haze = air quality</li>
            </ul>
          </div>
        )}
        <div ref={host} className="map" role="region" aria-label="Interactive 3D map of Makarba (a text list of the same places follows)" hidden={unavailable} />
        {!unavailable && (
          <div className="map-legend">
            <ul aria-label="Map legend">
              {Object.entries(CATEGORY_STYLE).map(([k, v]) => <li key={k}><span className="swatch" style={{ background: categoryColor(k) }} aria-hidden="true" />{v.label}</li>)}
            </ul>
          </div>
        )}
        {!unavailable && (
          <div className="mapctl" role="group" aria-label="Map controls">
            <button type="button" aria-label="Zoom in" data-tip="Zoom in (+)" onClick={() => mapRef.current?.zoomIn?.({ duration: reduced ? 0 : 450 })}><Icon name="plus" /></button>
            <button type="button" aria-label="Zoom out" data-tip="Zoom out (−)" onClick={() => mapRef.current?.zoomOut?.({ duration: reduced ? 0 : 450 })}><Icon name="minus" /></button>
            <span className="mapctl-sep" aria-hidden="true" />
            <button type="button" aria-label={`Reset north (bearing ${Math.round(((cam.bearing % 360) + 360) % 360)}°)`} data-tip="Reset north" onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: reduced ? 0 : 700 })}>
              <span className="compass" ref={compassRef} style={{ transform: `rotate(${-cam.bearing}deg)` }}><Icon name="north" /></span>
            </button>
            <button type="button" aria-label={cam.pitch > 5 ? "Look straight down" : "Tilt to 3D"} data-tip={cam.pitch > 5 ? "Look straight down (S)" : "Tilt (W)"} onClick={() => mapRef.current?.easeTo({ pitch: cam.pitch > 5 ? 0 : 60, duration: reduced ? 0 : 700 })}><Icon name="tilt" /></button>
            <button type="button" aria-label="Reset view" data-tip="Reset view (R)" onClick={() => { setOrbit(false); flyHome(true); }}><Icon name="locate" /></button>
            {typeof document !== "undefined" && document.fullscreenEnabled && <button type="button" aria-pressed={full} aria-label={full ? "Exit full screen" : "Full screen"} data-tip={full ? "Exit full screen" : "Full screen"} onClick={() => (full ? document.exitFullscreen() : wrapRef.current?.requestFullscreen())}><Icon name="expand" /></button>}
          </div>
        )}
        {!unavailable && (
          <div className="map-scale" aria-hidden="true"><span style={{ width: `${scalePx}px` }} />{nice >= 1000 ? `${nice / 1000} km` : `${nice} m`}</div>
        )}
        {!unavailable && <p className="map-attrib">{sourceAttribution} · {BASEMAP_ATTRIBUTION}</p>}
      </div>
      {unavailable && (
        <>
          <p role="status">The map is unavailable on this device. Use the list of places below – it has the same information.</p>
          <Fallback2D features={features} selectedId={selectedId ?? null} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
