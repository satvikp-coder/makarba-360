import { useEffect, useMemo, useState } from "react";
import { makeFrame, pathOf } from "./pastGeo.js";

/**
 * 2D context map of Sarkhej Roza drawn from the project's own OpenStreetMap extracts (data/geo/*.json, ODbL, retrieved 2026-11-13).
 * Everything drawn here is TODAY's mapped condition ("observed"). No historical boundary, road line or scheme boundary is drawn
 * because none is held with a source and CRS; the legend says so. Light-weight SVG so it works without WebGL.
 */
type LngLat = [number, number];
interface Layer { id: "complex" | "tank" | "highway" | "arterial" | "canal"; label: string; kind: "area" | "line"; paths: LngLat[][]; colour: string }
/** Extra layers from the validated registry, drawn over the present-day OSM context. `status` is shown in the legend so plans and observations stay apart. */
export interface Overlay { id: string; label: string; kind: "area" | "line"; paths: LngLat[][]; colour: string; status: string; year: number }
export interface PastMapProps { fetcher?: typeof fetch; focus?: LngLat; overlays?: Overlay[]; onOsm?: (osm: { complex: LngLat[]; roads: { id: string; label: string; line: LngLat[] }[] }) => void }

const ROZA: LngLat = [72.50539, 22.99342];
const BOX = { w: 640, h: 420 };

async function load(fetcher: typeof fetch, signal: AbortSignal): Promise<Layer[]> {
  const get = async (u: string) => { const r = await fetcher(u, { signal }); if (!r.ok) throw new Error(u); return r.json(); };
  const [roads, lm] = await Promise.all([get("/geo/osm-roads.json"), get("/geo/osm-landmarks.json")]);
  const ring = (key: string): LngLat[][] => (lm.features as { properties: { key: string }; geometry: { coordinates: LngLat[][] } }[]).filter((f) => f.properties.key === key).map((f) => f.geometry.coordinates[0]!);
  return [
    { id: "complex", label: "Sarkhej Roza complex (OSM outline)", kind: "area", paths: ring("complex"), colour: "var(--accent)" },
    { id: "tank", label: "Sarkhej tank / Ahmed Sar (OSM outline)", kind: "area", paths: ring("lake"), colour: "var(--teal-2)" },
    { id: "highway", label: "S.G. Highway, NH147 (OSM)", kind: "line", paths: [roads.highway.coordinates], colour: "#7457c4" },
    { id: "arterial", label: "Sarkhej road, NH8A (OSM)", kind: "line", paths: [roads.arterial.coordinates], colour: "#b4532a" },
    { id: "canal", label: "Canal near Makarba (OSM)", kind: "line", paths: [roads.canal.coordinates], colour: "#2a7fa8" },
  ];
}

export function PastMap({ fetcher = fetch, focus = ROZA, overlays = [], onOsm }: PastMapProps) {
  const [layers, setLayers] = useState<Layer[] | null>(null);
  const [err, setErr] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({ complex: true, tank: true, highway: true, arterial: true, canal: true });
  useEffect(() => {
    const ac = new AbortController();
    load(fetcher, ac.signal).then((l) => { if (!ac.signal.aborted) { setLayers(l); onOsm?.({ complex: l.find((x) => x.id === "complex")?.paths[0] ?? [], roads: l.filter((x) => x.id === "highway" || x.id === "arterial").map((x) => ({ id: x.id, label: x.label, line: x.paths[0] ?? [] })) }); } }).catch(() => { if (!ac.signal.aborted) setErr(true); });
    return () => ac.abort();
  }, [fetcher]);

  const proj = useMemo(() => (layers ? makeFrame(focus, 0.019, BOX.w, BOX.h) : null), [layers, focus]);

  if (err) return <p role="alert" className="past-state">The map outlines could not be loaded. The facts and records on this page are unaffected.</p>;
  if (!layers || !proj) return <p role="status" className="past-state">Loading map outlines…</p>;
  const d = (p: LngLat[], close: boolean) => pathOf(p, proj, close);
  return (
    <figure className="past-map">
      <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-labelledby="pm-t pm-d" className="past-map-svg">
        <title id="pm-t">Sarkhej Roza and its surroundings, mapped today</title>
        <desc id="pm-d">A schematic of present-day mapped features: the Roza complex and tank, the S.G. Highway, the Sarkhej road and a canal. No historical boundaries are shown.</desc>
        <rect width={BOX.w} height={BOX.h} rx="14" className="pm-bg" />
        {layers.filter((l) => on[l.id]).map((l) => l.paths.map((p, i) => (
          <path key={`${l.id}${i}`} d={d(p, l.kind === "area")} fill={l.kind === "area" ? l.colour : "none"} fillOpacity={l.kind === "area" ? 0.28 : 0}
            stroke={l.colour} strokeWidth={l.kind === "area" ? 2 : 4} strokeLinejoin="round" strokeLinecap="round" />
        )))}
        {overlays.filter((o) => on[o.id] !== false).map((o) => o.paths.map((p, i) => (
          <path key={`${o.id}${i}`} d={d(p, o.kind === "area")} fill={o.kind === "area" ? o.colour : "none"} fillOpacity={o.kind === "area" ? 0.22 : 0} stroke={o.colour}
            strokeWidth={o.kind === "area" ? 2 : 3} strokeDasharray={/proposed|sanctioned/.test(o.status) ? "6 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
        )))}
        <g transform={`translate(${proj.x(focus[0]).toFixed(1)} ${proj.y(focus[1]).toFixed(1)})`}>
          <circle r="7" className="pm-pin" /><circle r="14" className="pm-ring" />
        </g>
        <text x="16" y={BOX.h - 14} className="pm-note">Observed today · © OpenStreetMap contributors (ODbL) · retrieved 2026-11-13 · schematic, not to survey accuracy</text>
      </svg>
      <figcaption>
        <fieldset className="past-layers">
          <legend>Layers (present-day mapping)</legend>
          {layers.map((l) => (
            <label key={l.id}><input type="checkbox" checked={on[l.id]} onChange={() => setOn({ ...on, [l.id]: !on[l.id] })} /><i style={{ background: l.colour }} aria-hidden="true" /> {l.label}</label>
          ))}
          {overlays.map((o) => (
            <label key={o.id}><input type="checkbox" checked={on[o.id] !== false} onChange={() => setOn({ ...on, [o.id]: on[o.id] === false })} /><i style={{ background: o.colour }} aria-hidden="true" /> {o.label} <small>({o.status}, {o.year})</small></label>
          ))}
        </fieldset>
        {overlays.length === 0 && <p className="past-limit">No historical outline, road line or town-planning boundary is drawn here: none is held with a reviewed source and coordinate system. See “What is still missing”.</p>}
      </figcaption>
    </figure>
  );
}
