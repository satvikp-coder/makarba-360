import { useEffect, useId, useMemo, useState } from "react";
import { Icon } from "../Icon.js";
import { PastMap, type Overlay } from "./PastMap.js";
import {
  KIND_COLOUR, KIND_LABEL, byYear, compareCheck, fetchLayer, fetchRegistry, linesOf, makeFrame, outlineToLineMetres, pathOf, ringsOf,
  type LayerData, type LngLat, type RegLayer, type Registry,
} from "./pastGeo.js";
import { STATUS_LABEL } from "./pastModel.js";

export type RegistryState = { s: "loading" } | { s: "missing" } | { s: "error" } | { s: "ok"; reg: Registry };

export function useRegistry(fetcher?: typeof fetch): RegistryState {
  const [st, setSt] = useState<RegistryState>({ s: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    fetchRegistry(ac.signal, fetcher).then((r) => { if (!ac.signal.aborted) setSt(r.status === "ok" ? { s: "ok", reg: r.data } : { s: r.status }); });
    return () => ac.abort();
  }, [fetcher]);
  return st;
}

const BOX = { w: 640, h: 420 };
const ROZA: LngLat = [72.50539, 22.99342];
const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

/** Loads the geometry of every available layer once; a failed layer is reported by id, the rest still draw. */
function useLayerData(layers: RegLayer[], fetcher?: typeof fetch) {
  const [data, setData] = useState<Record<string, LayerData>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const key = layers.map((l) => l.id + l.sha256).join("|");
  useEffect(() => {
    const ac = new AbortController();
    setData({}); setFailed([]);
    layers.forEach((l) => fetchLayer(l, ac.signal, fetcher).then((r) => {
      if (ac.signal.aborted) return;
      if (r.status === "ok") setData((d) => ({ ...d, [l.id]: r.data })); else setFailed((f) => [...f, l.id]);
    }));
    return () => ac.abort();
  }, [key, fetcher]);
  return { data, failed };
}

const planned = (s: string) => s === "proposed" || s === "sanctioned";

function SplitCompare({ layers, data }: { layers: RegLayer[]; data: Record<string, LayerData> }) {
  const sorted = useMemo(() => [...layers].sort(byYear), [layers]);
  const [a, setA] = useState(sorted[0]?.id ?? "");
  const [b, setB] = useState(sorted[1]?.id ?? "");
  const [pos, setPos] = useState(50);
  const id = useId();
  useEffect(() => { setA((x) => (sorted.some((l) => l.id === x) ? x : sorted[0]?.id ?? "")); setB((x) => (sorted.some((l) => l.id === x) ? x : sorted[1]?.id ?? "")); }, [sorted]);
  if (sorted.length < 2) {
    return <p className="past-empty" role="note"><Icon name="info" size={16} /> A before/after comparison needs two dated layers of the same kind. {sorted.length === 1 ? "One is available." : "None is available yet."} The evidence each layer needs is listed below.</p>;
  }
  const la = sorted.find((l) => l.id === a), lb = sorted.find((l) => l.id === b);
  const check = la && lb ? compareCheck(la, lb) : null;
  const frame = makeFrame(ROZA, 0.019, BOX.w, BOX.h);
  const draw = (l: RegLayer | undefined, clip?: string) => {
    const d = l ? data[l.id] : undefined;
    if (!l || !d) return null;
    const area = l.kind !== "roads";
    return (
      <g clipPath={clip}>
        {d.features.flatMap((f, i) => (area ? ringsOf(f.geometry) : linesOf(f.geometry)).map((p, j) => (
          <path key={`${i}-${j}`} d={pathOf(p, frame, area)} fill={area ? KIND_COLOUR[l.kind] : "none"} fillOpacity={area ? 0.3 : 0} stroke={KIND_COLOUR[l.kind]} strokeWidth={area ? 2 : 3} strokeDasharray={planned(l.meta.status) ? "6 4" : undefined} />
        )))}
      </g>
    );
  };
  const sel = (label: string, v: string, set: (x: string) => void) => (
    <label>{label} <select value={v} onChange={(e) => set(e.target.value)}>{sorted.map((l) => <option key={l.id} value={l.id}>{l.meta.asOf.year} · {l.title} ({STATUS_LABEL[l.meta.status]})</option>)}</select></label>
  );
  return (
    <div className="past-split">
      <div className="past-split-pick">{sel("Left (clipped to the left of the handle)", a, setA)}{sel("Right", b, setB)}</div>
      {check && !check.ok && <p className="past-empty" role="note"><Icon name="info" size={16} /> {check.reason}</p>}
      {check?.ok && (
        <>
          <p className="past-limit">{check.label}</p>
          <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label={`Split view: ${la!.title} (${la!.meta.asOf.year}) on the left and ${lb!.title} (${lb!.meta.asOf.year}) on the right, ${pos}% from the left`} className="past-map-svg">
            <defs><clipPath id={`${id}-l`}><rect x="0" y="0" width={(BOX.w * pos) / 100} height={BOX.h} /></clipPath><clipPath id={`${id}-r`}><rect x={(BOX.w * pos) / 100} y="0" width={BOX.w} height={BOX.h} /></clipPath></defs>
            <rect width={BOX.w} height={BOX.h} rx="14" className="pm-bg" />
            {draw(la, `url(#${id}-l)`)}{draw(lb, `url(#${id}-r)`)}
            <line x1={(BOX.w * pos) / 100} x2={(BOX.w * pos) / 100} y1="0" y2={BOX.h} className="pm-split" />
            <text x="12" y="20" className="pm-note">{la!.meta.asOf.year} · {STATUS_LABEL[la!.meta.status]}</text>
            <text x={BOX.w - 12} y="20" textAnchor="end" className="pm-note">{lb!.meta.asOf.year} · {STATUS_LABEL[lb!.meta.status]}</text>
          </svg>
          <label className="past-split-slider">Handle position <input type="range" min={0} max={100} step={1} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-valuetext={`${pos}% from the left`} /></label>
          <p className="past-meta">Left: {la!.meta.source.title}, {la!.meta.licence}, confidence {la!.meta.confidence}. Right: {lb!.meta.source.title}, {lb!.meta.licence}, confidence {lb!.meta.confidence}.</p>
        </>
      )}
    </div>
  );
}

/** Registry-driven map, legend, proximity figures, split comparison and the list of layers still waiting for evidence. */
export function PastExplorer({ fetcher, registry }: { fetcher?: typeof fetch; registry: RegistryState }) {
  const avail = registry.s === "ok" ? registry.reg.layers : [];
  const slots = registry.s === "ok" ? registry.reg.slots : [];
  const { data, failed } = useLayerData(avail, fetcher);
  const years = [...new Set(avail.map((l) => l.meta.asOf.year))].sort((a, b) => a - b);
  const [year, setYear] = useState<number | null>(null);
  const shownYear = year ?? years[years.length - 1] ?? null;
  const [osm, setOsm] = useState<{ complex: LngLat[]; roads: { id: string; label: string; line: LngLat[] }[] } | null>(null);

  // Per kind, the latest layer at or before the chosen year (all TP boundaries up to that year, since each describes a different scheme).
  const visible = avail.filter((l) => shownYear !== null && l.meta.asOf.year <= shownYear).filter((l, _i, all) => l.kind === "tp-boundary" || all.filter((o) => o.kind === l.kind && o.meta.asOf.year <= shownYear!).sort(byYear).pop()?.id === l.id);
  const overlays: Overlay[] = visible.flatMap((l) => {
    const d = data[l.id];
    if (!d) return [];
    const area = l.kind !== "roads";
    return [{ id: l.id, label: l.title, kind: area ? "area" : "line", colour: KIND_COLOUR[l.kind], status: l.meta.status, year: l.meta.asOf.year,
      paths: d.features.flatMap((f) => (area ? ringsOf(f.geometry) : linesOf(f.geometry))) } as Overlay];
  });

  const prox = useMemo(() => {
    if (!osm || osm.complex.length === 0) return null;
    return osm.roads.map((r) => ({ id: r.id, label: r.label, metres: outlineToLineMetres(osm.complex, r.line) }));
  }, [osm]);
  const roadLayers = avail.filter((l) => l.kind === "roads" && data[l.id]).sort(byYear);

  return (
    <div className="past-explorer">
      <PastMap fetcher={fetcher} overlays={overlays} onOsm={setOsm} />

      <ul className="past-legend" aria-label="What the map symbols mean">
        <li><i className="lg lg-obs" aria-hidden="true" /> <b>Observed today</b>: present-day OpenStreetMap outlines</li>
        <li><i className="lg lg-ver" aria-hidden="true" /> <b>Verified layer</b>: imported with source, licence, date and validation</li>
        <li><i className="lg lg-plan" aria-hidden="true" /> <b>Planned</b>: proposed or sanctioned, drawn dashed; not necessarily built</li>
        <li><i className="lg lg-miss" aria-hidden="true" /> <b>Missing evidence</b>: listed below, never drawn</li>
        <li><i className="lg lg-inc" aria-hidden="true" /> <b>Incompatible</b>: different kind or same year, never compared</li>
      </ul>

      {registry.s === "loading" && <p role="status" className="past-state">Loading the layer registry…</p>}
      {registry.s === "error" && <p role="alert" className="past-state">The layer registry could not be loaded. The present-day map above is unaffected.</p>}
      {registry.s === "missing" && <p role="status" className="past-state">No layer registry is published, so no historical layers are shown.</p>}
      {failed.length > 0 && <p role="alert" className="past-state">Some layer files could not be loaded: {failed.join(", ")}.</p>}

      {years.length > 1 && shownYear !== null && (
        <label className="past-yearpick">Show layers as of <b>{shownYear}</b>
          <input type="range" min={years[0]} max={years[years.length - 1]} step={1} value={shownYear} onChange={(e) => setYear(Number(e.target.value))} aria-valuetext={`${shownYear}`} />
        </label>
      )}

      <section aria-labelledby="past-prox" className="card past-card">
        <h3 id="past-prox">How close are the main roads to the Roza?</h3>
        {prox === null ? <p className="past-empty">Measured once the map outlines have loaded.</p> : (
          <table className="past-table">
            <caption>Nearest distance from the Roza complex outline to each road</caption>
            <thead><tr><th scope="col">Road</th><th scope="col">Year</th><th scope="col">Status</th><th scope="col">Distance</th></tr></thead>
            <tbody>
              {prox.map((p) => <tr key={p.id}><th scope="row">{p.label}</th><td>2026</td><td>Observed today</td><td>{fmtM(p.metres)}</td></tr>)}
              {osm && roadLayers.map((l) => {
                const m = Math.min(...data[l.id]!.features.flatMap((f) => linesOf(f.geometry)).map((ln) => outlineToLineMetres(osm.complex, ln)));
                return <tr key={l.id}><th scope="row">{l.title}</th><td>{l.meta.asOf.year}</td><td>{STATUS_LABEL[l.meta.status]}</td><td>{fmtM(m)}</td></tr>;
              })}
            </tbody>
          </table>
        )}
        <p className="past-meta"><b>Method:</b> shortest distance from any vertex of the OpenStreetMap outline of the Roza complex to the mapped road centreline, on a local flat plane. <b>Limits:</b> accurate to about the outline's vertex spacing; the roads are today's mapped lines, so no change over time is claimed until a dated historical road layer is imported.</p>
      </section>

      <section aria-labelledby="past-split" className="past-card">
        <h3 id="past-split">Compare two dates</h3>
        <SplitCompare layers={avail} data={data} />
      </section>

      <section aria-labelledby="past-slots">
        <h3 id="past-slots">Layers waiting for evidence ({slots.length})</h3>
        <p className="past-limit">These layers are built into the page but are switched off because no verified source has been imported. Each says what is needed.</p>
        <ul className="past-slotlist">
          {slots.map((s) => (
            <li key={s.id}>
              <details>
                <summary><Icon name="info" size={14} /> {s.title} <small>({KIND_LABEL[s.kind]}, unavailable)</small></summary>
                <p><b>Needed:</b> {s.evidenceRequired}</p>
                <p><b>Acceptable sources:</b> {s.acceptableSources.join("; ")}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
