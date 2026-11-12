import type { PublicFeature } from "../api.js";
import { categoryColor } from "../categories.js";
import { CANAL, HIGHWAY, LAKE, MAKARBA_BOUNDS, ROZA, roads, type Pos } from "./basemap.js";

const [[W, S], [E, N]] = MAKARBA_BOUNDS;
const KX = Math.cos((23 * Math.PI) / 180);
const VW = 1000;
const VH = Math.round((VW * (N - S)) / ((E - W) * KX));
const xy = ([lon, lat]: Pos) => `${(((lon - W) / (E - W)) * VW).toFixed(1)},${(((N - lat) / (N - S)) * VH).toFixed(1)}`;
const path = (pts: Pos[], close = false) => `M${pts.map(xy).join("L")}${close ? "Z" : ""}`;

/**
 * 2D drawing shown when WebGL is unavailable: the same offline basemap and published places as flat SVG. It is a picture, so it
 * is one labelled image; the list of places next to it is the operable, accessible alternative (pointer users can also click).
 */
export function Fallback2D({ features, selectedId, onSelect }: { features: PublicFeature[]; selectedId: string | null; onSelect?: (id: string) => void }) {
  return (
    <svg className="map-2d" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="Flat 2D sketch of the Makarba map: lake, canal, highway, Sarkhej Roza and the published places. The list of places has the same information.">
      <rect width={VW} height={VH} fill="#efe8da" />
      <path d={path(LAKE, true)} fill="#7fbfd4" />
      <path d={path(CANAL)} stroke="#7fbfd4" strokeWidth="10" fill="none" strokeLinecap="round" />
      {roads.features.map((r, i) => (
        <path key={i} d={path(r.geometry.coordinates as Pos[])} stroke={r.properties["kind"] === "highway" ? "#e2b45c" : "#ffffff"} strokeWidth={r.properties["kind"] === "highway" ? 14 : r.properties["kind"] === "arterial" ? 9 : 5} fill="none" strokeLinecap="round" />
      ))}
      <path d={path(HIGHWAY)} stroke="#b5522f" strokeWidth="1.5" strokeDasharray="6 8" fill="none" />
      <path d={path(ROZA, true)} fill="#d9a066" stroke="#9a3b1f" strokeWidth="2" />
      {features.map((f) => {
        const c = categoryColor(f.properties.category);
        const sel = String(f.id) === selectedId;
        const click = () => onSelect?.(String(f.id));
        const g = f.geometry;
        if (g.type === "Point") {
          const [x, y] = xy(g.coordinates as Pos).split(",").map(Number);
          return <circle key={String(f.id)} cx={x} cy={y} r={sel ? 16 : 10} fill={c} stroke={sel ? "#163d3b" : "#fff"} strokeWidth="4" onClick={click} />;
        }
        if (g.type === "MultiLineString") return <path key={String(f.id)} d={(g.coordinates as Pos[][]).map((l) => path(l)).join("")} stroke={c} strokeWidth={sel ? 12 : 7} fill="none" strokeLinecap="round" onClick={click} />;
        if (g.type === "MultiPolygon") return <path key={String(f.id)} d={(g.coordinates as Pos[][][]).map((p) => path(p[0]!, true)).join("")} fill={c} fillOpacity={sel ? 0.75 : 0.45} stroke={c} strokeWidth="3" onClick={click} />;
        return null;
      })}
    </svg>
  );
}
