import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
// maplibre-gl 6 finds its worker next to its own module, which no longer exists once the app is bundled, so the worker file is
// emitted as an asset and its URL is given explicitly (verified against the production build in the browser tests).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl(workerUrl);
import type { PublicFeature } from "../api.js";
import { categoryColor, categoryColorExpression, CATEGORY_STYLE } from "../categories.js";
import { easeInOutCubic, useReducedMotion } from "../motion.js";
import { BASE_LABELS, BASEMAP_ATTRIBUTION, buildOfflineStyle, DASH_STEPS, MAKARBA_BOUNDS, MAKARBA_CENTER, THEMES, themedPaint, type Pos, type TimeOfDay } from "./basemap.js";
import { Fallback2D } from "./Fallback2D.js";
import { TOUR } from "./tour.js";

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
}

const LIGHTS: { id: TimeOfDay; label: string }[] = [{ id: "day", label: "Day" }, { id: "dusk", label: "Dusk" }, { id: "night", label: "Night" }];

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
export function MapView({ features, sourceAttribution, selectedId, onSelect, onStatus }: Props) {
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
  const [is3d, setIs3d] = useState(true);
  const [paused, setPaused] = useState(reduced);
  const [intro, setIntro] = useState<"pending" | "flying" | "done">("pending");
  const [tour, setTour] = useState<number | null>(null);
  const tourPanel = useRef<HTMLDivElement>(null);
  const report = (s: MapStatus) => { setStatus(s); onStatus?.(s); };
  useEffect(() => { if (reduced) setPaused(true); }, [reduced]);

  const flyHome = (animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const view = { ...HOME_VIEW, pitch: is3d ? HOME_VIEW.pitch : 0 };
    if (!animate || reducedRef.current) { map.jumpTo(view); setIntro("done"); return; }
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
        attributionControl: false, cooperativeGestures: true, maxPitch: 70,
        maxBounds: [[MAKARBA_BOUNDS[0][0] - 0.03, MAKARBA_BOUNDS[0][1] - 0.03], [MAKARBA_BOUNDS[1][0] + 0.03, MAKARBA_BOUNDS[1][1] + 0.03]],
        canvasContextAttributes: { antialias: true },
      });
    } catch {
      report("unavailable");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
    if (maplibregl.ScaleControl) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: [sourceAttribution, BASEMAP_ATTRIBUTION] }), "bottom-right");
    const lost = () => report("unavailable");
    map.getCanvas().addEventListener("webglcontextlost", lost);
    map.on("error", (e: { error?: { message?: string } }) => {
      if (/webgl|context/i.test(e.error?.message ?? "")) lost();
      else if (import.meta.env.DEV) console.warn("map:", e.error?.message);
    });
    const zoomClass = () => host.current?.parentElement?.classList.toggle("labels-far", map.getZoom() < LABEL_MIN_ZOOM);
    map.on("zoom", zoomClass);
    map.on("load", () => {
      // Only published, contract-validated features are ever added. Clustering applies to points only.
      map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
      const isPoint = ["all", ["==", ["geometry-type"], "Point"], ["!", ["has", "point_count"]]] as unknown as maplibregl.FilterSpecification;
      const color = categoryColorExpression() as unknown as maplibregl.ExpressionSpecification;
      map.addLayer({ id: "places-fill", type: "fill-extrusion", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-extrusion-color": color, "fill-extrusion-height": 3, "fill-extrusion-opacity": 0.55, "fill-extrusion-height-transition": { duration: 700, delay: 0 } } });
      map.addLayer({ id: "places-line", type: "line", source: SRC, filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 9], "line-opacity": 0.85 } });
      map.addLayer({ id: "places-cluster", type: "circle", source: SRC, filter: ["has", "point_count"], paint: { "circle-color": "#E6BC6C", "circle-stroke-width": 2, "circle-stroke-color": "#163D3B", "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 20, 24] } });
      map.addLayer({ id: "places-point", type: "circle", source: SRC, filter: isPoint, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 11], "circle-color": color, "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff", "circle-pitch-alignment": "map" } });
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
  const placeLabels = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: features as unknown as never[] });
    placeLabels.current.forEach((m) => m.remove());
    placeLabels.current = features.flatMap((f) => {
      const at = anchorOf(f);
      if (!at) return [];
      const d = el("map-label map-label--place", nameOf(f));
      d.style.setProperty("--c", categoryColor(f.properties.category));
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
  }, [features, status]);

  // Selection: highlight colour/extrusion, a pulsing ring, and a flight to the place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("places-point")) return;
    const sel = (a: unknown, b: unknown) => (selectedId ? ["case", ["==", ["get", "locationId"], selectedId], a, b] : b) as never;
    map.setPaintProperty("places-point", "circle-radius", sel(15, ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 11]));
    map.setPaintProperty("places-point", "circle-stroke-color", sel("#163D3B", "#ffffff"));
    map.setPaintProperty("places-fill", "fill-extrusion-height", sel(26, 3));
    map.setPaintProperty("places-line", "line-width", sel(14, ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 9]));
    pulseRef.current?.remove();
    pulseRef.current = null;
    const f = selectedId ? features.find((x) => String(x.id) === selectedId) : undefined;
    const at = f ? anchorOf(f) : null;
    if (!f || !at) return;
    const ring = el("map-pulse");
    ring.style.setProperty("--c", categoryColor(f.properties.category));
    ring.appendChild(document.createElement("span"));
    pulseRef.current = new maplibregl.Marker({ element: ring, anchor: "center" }).setLngLat(at).addTo(map);
    const view = { center: at, zoom: Math.max(map.getZoom(), 16.2), pitch: is3d ? 62 : 0, bearing: map.getBearing() };
    if (reducedRef.current) map.jumpTo(view);
    else map.flyTo({ ...view, duration: 1700, curve: 1.3, easing: easeInOutCubic, essential: true });
    // the camera should move only when the selection changes, not when the 3D toggle does
  }, [selectedId, status, features]);

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
    const s = TOUR[tour]!;
    const view = { center: s.center, zoom: s.zoom, pitch: is3d ? s.pitch : 0, bearing: s.bearing };
    if (reducedRef.current) map.jumpTo(view);
    else map.flyTo({ ...view, duration: 3200, curve: 1.4, easing: easeInOutCubic, essential: true });
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
      if (document.hidden || now - last < 85) return;
      last = now;
      step = (step + 1) % n;
      map.setPaintProperty("canal-flow", "line-dasharray", DASH_STEPS[step]);
      map.setPaintProperty("traffic-a", "line-dasharray", DASH_STEPS[step]);
      map.setPaintProperty("traffic-b", "line-dasharray", DASH_STEPS[(n - step) % n]);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, paused, flying]);

  const unavailable = status === "unavailable";
  return (
    <div className="map-wrap" data-map-status={status} data-rendered={rendered ? "true" : "false"} data-motion={reduced ? "reduced" : "full"} data-paused={paused ? "true" : "false"} data-time={time} data-intro={intro}>
      {!unavailable && (
        <div className="map-toolbar" role="group" aria-label="Map view">
          <button type="button" aria-pressed={is3d} onClick={() => setIs3d(!is3d)}>3D buildings</button>
          <span className="seg" role="group" aria-label="Lighting">
            {LIGHTS.map((l) => <button key={l.id} type="button" aria-pressed={time === l.id} onClick={() => setTime(l.id)}>{l.label}</button>)}
          </span>
          <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Play motion" : "Pause motion"}</button>
          <button type="button" onClick={() => flyHome(true)}>Replay fly-in</button>
          <button type="button" className="tour-start" aria-pressed={tour !== null} onClick={() => setTour(tour === null ? 0 : null)}>{tour === null ? "Start story tour" : "End story tour"}</button>
        </div>
      )}
      {!unavailable && tour !== null && (() => {
        const s = TOUR[tour]!;
        return (
          <div className="tour" role="region" aria-label="Story tour" ref={tourPanel} tabIndex={-1} key={s.id}>
            <p className="tour-kind">{s.kind === "sourced" ? "Sourced fact" : "Example narrative"}</p>
            <h2>{s.title} <small>(stop {tour + 1} of {TOUR.length})</small></h2>
            <p>{s.caption}{s.source && <small> Source: {s.source}.</small>}</p>
            <div className="tour-nav">
              <button type="button" disabled={tour === 0} onClick={() => setTour(tour - 1)}>Previous stop</button>
              {tour < TOUR.length - 1 ? <button type="button" onClick={() => setTour(tour + 1)}>Next stop</button> : <button type="button" onClick={() => { setTour(null); flyHome(true); }}>Finish tour</button>}
              <button type="button" onClick={() => setTour(null)}>End story tour</button>
            </div>
            <ol className="tour-dots" aria-hidden="true">{TOUR.map((x, i) => <li key={x.id} className={i === tour ? "on" : ""} />)}</ol>
          </div>
        );
      })()}
      <div className="map-stage">
        <div ref={host} className="map" role="region" aria-label="Interactive 3D map of Makarba (a text list of the same places follows)" hidden={unavailable} />
        {!unavailable && (
          <div className="map-legend">
            <ul aria-label="Map legend">
              {Object.entries(CATEGORY_STYLE).map(([k, v]) => <li key={k}><span className="swatch" style={{ background: v.color }} aria-hidden="true" />{v.label}</li>)}
            </ul>
          </div>
        )}
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
