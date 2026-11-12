import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
// maplibre-gl 6 finds its worker next to its own module, which no longer exists once the app is bundled, so the worker file is
// emitted as an asset and its URL is given explicitly (verified against the production build in the browser tests).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
if (typeof maplibregl.setWorkerUrl === "function") maplibregl.setWorkerUrl(workerUrl);
import type { PublicFeature } from "../api.js";

/** Standard OSM raster tiles for development/pilot only (docs/architecture/gis-design.md, issue #24). Override with VITE_BASEMAP_TILE_URL. */
export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const SRC = "places";

export function buildStyle(tileUrl: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { basemap: { type: "raster", tiles: [tileUrl], tileSize: 256, attribution: OSM_ATTRIBUTION, maxzoom: 19 } },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

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

export type MapStatus = "loading" | "ready" | "unavailable";

interface Props {
  features: PublicFeature[];
  sourceAttribution: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onStatus?: (s: MapStatus) => void;
  tileUrl?: string;
}

/**
 * Presentational map for already-validated, published public features. It never reads private data.
 * Any initialisation failure or WebGL context loss is reported through onStatus("unavailable") so the page
 * keeps its list alternative as the working path.
 */
export function MapView({ features, sourceAttribution, selectedId, onSelect, onStatus, tileUrl = import.meta.env.VITE_BASEMAP_TILE_URL ?? DEFAULT_TILE_URL }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const report = (s: MapStatus) => { setStatus(s); onStatus?.(s); };

  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current, style: buildStyle(tileUrl), center: [0, 0], zoom: 1, attributionControl: false,
        cooperativeGestures: true, maxPitch: 75,
      });
    } catch {
      report("unavailable");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: sourceAttribution }), "bottom-right");
    const lost = () => report("unavailable");
    map.getCanvas().addEventListener("webglcontextlost", lost);
    map.on("error", (e: { error?: { message?: string } }) => { if (/webgl|context/i.test(e.error?.message ?? "")) lost(); });
    map.on("load", () => {
      // Only published, contract-validated features are ever added. Clustering applies to points only.
      map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
      const isPoint = ["all", ["==", ["geometry-type"], "Point"], ["!", ["has", "point_count"]]] as unknown as maplibregl.FilterSpecification;
      map.addLayer({ id: "places-fill", type: "fill", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#4C91A3", "fill-opacity": 0.35 } });
      map.addLayer({ id: "places-line", type: "line", source: SRC, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#163D3B", "line-width": 3 } });
      map.addLayer({ id: "places-cluster", type: "circle", source: SRC, filter: ["has", "point_count"], paint: { "circle-color": "#E6BC6C", "circle-stroke-width": 2, "circle-stroke-color": "#163D3B", "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 20, 24] } });
      map.addLayer({ id: "places-point", type: "circle", source: SRC, filter: isPoint, paint: { "circle-radius": 8, "circle-color": "#D27A55", "circle-stroke-width": 2, "circle-stroke-color": "#163D3B" } });
      const pick = (e: { features?: { properties?: Record<string, unknown> }[] }) => {
        const id = e.features?.[0]?.properties?.["locationId"];
        if (typeof id === "string") onSelect?.(id);
      };
      map.on("click", "places-point", pick);
      map.on("click", "places-fill", pick);
      map.on("click", "places-line", pick);
      map.on("click", "places-cluster", (e: { features?: { properties?: Record<string, unknown> }[]; lngLat?: { lng: number; lat: number } }) => {
        const cid = e.features?.[0]?.properties?.["cluster_id"];
        const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
        if (typeof cid !== "number" || !e.lngLat) return;
        src.getClusterExpansionZoom(cid).then((zoom: number) => map.easeTo({ center: [e.lngLat!.lng, e.lngLat!.lat], zoom }));
      });
      report("ready");
    });
    return () => { map.getCanvas().removeEventListener("webglcontextlost", lost); map.remove(); mapRef.current = null; };
  }, [tileUrl, sourceAttribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: features as unknown as never[] });
    const box = boundsOf(features);
    if (box) map.fitBounds(box, { padding: 48, maxZoom: 15, duration: 0 });
  }, [features, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("places-point")) return;
    map.setPaintProperty("places-point", "circle-radius", selectedId ? ["case", ["==", ["get", "locationId"], selectedId], 12, 8] : 8);
    map.setPaintProperty("places-point", "circle-color", selectedId ? ["case", ["==", ["get", "locationId"], selectedId], "#163D3B", "#D27A55"] : "#D27A55");
  }, [selectedId, status]);

  const [tilted, setTilted] = useState(false);
  const toggleTilt = () => {
    const next = !tilted; setTilted(next);
    mapRef.current?.easeTo({ pitch: next ? 60 : 0, bearing: next ? -20 : 0, duration: 900 });
  };

  return (
    <div className="map-wrap">
      {status !== "unavailable" && <button type="button" className="tilt" aria-pressed={tilted} onClick={toggleTilt}>3D view</button>}
      <div ref={el} className="map" role="region" aria-label="Interactive map (a text list of the same places follows)" hidden={status === "unavailable"} />
      {status === "unavailable" && <p role="status">The map is unavailable on this device. Use the list of places below – it has the same information.</p>}
    </div>
  );
}
