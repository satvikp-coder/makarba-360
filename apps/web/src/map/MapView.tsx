import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
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
        cooperativeGestures: true,
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
      map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "places-fill", type: "fill", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#4C91A3", "fill-opacity": 0.35 } });
      map.addLayer({ id: "places-line", type: "line", source: SRC, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#163D3B", "line-width": 3 } });
      map.addLayer({ id: "places-point", type: "circle", source: SRC, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 8, "circle-color": "#D27A55", "circle-stroke-width": 2, "circle-stroke-color": "#163D3B" } });
      map.on("click", "places-point", (e) => { const id = e.features?.[0]?.id; if (typeof id === "string") onSelect?.(id); });
      report("ready");
    });
    return () => { map.getCanvas().removeEventListener("webglcontextlost", lost); map.remove(); mapRef.current = null; };
  }, [tileUrl, sourceAttribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: features as unknown as GeoJSON.Feature[] });
  }, [features, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("places-point")) return;
    map.setPaintProperty("places-point", "circle-radius", selectedId ? ["case", ["==", ["id"], selectedId], 12, 8] : 8);
  }, [selectedId, status]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="region" aria-label="Interactive map (a text list of the same places follows)" hidden={status === "unavailable"} />
      {status === "unavailable" && <p role="status">The map is unavailable on this device. Use the list of places below – it has the same information.</p>}
    </div>
  );
}
