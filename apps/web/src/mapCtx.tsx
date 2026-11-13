import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PublicFeature } from "./api.js";
import type { Scenario } from "./scenario.js";

/**
 * Shared state between the always-mounted 3D map stage and the floating panels. Kept tiny (no heavy imports) because it is part
 * of the entry bundle; the map, scenario maths and AI load lazily with the stage.
 */
export type Lens = "places" | "heat" | "air" | "growth" | "mobility";
export interface MapHighlight { id: string; title: string; at: [number, number]; tone?: string }

interface MapState {
  /** Places drawn on the map: all published places, or the explore panel's filtered/searched view. */
  features: PublicFeature[] | null; setFeatures: (f: PublicFeature[] | null) => void;
  /** Overrides from the explore panel (filters/search); null = show everything. */
  view: PublicFeature[] | null; setView: (f: PublicFeature[] | null) => void;
  selectedId: string | null; setSelectedId: (id: string | null) => void;
  /** Time: "today" or a future year on the timeline. */
  future: boolean; setFuture: (on: boolean) => void;
  year: number; setYear: (y: number) => void;
  playing: boolean; setPlaying: (on: boolean) => void;
  lens: Lens; setLens: (l: Lens) => void;
  /** Published by the stage once forecasts are loaded. */
  scenario: Scenario | null; setScenario: (s: Scenario | null) => void;
  highlights: MapHighlight[] | null; setHighlights: (h: MapHighlight[] | null) => void;
  focusId: string | null; setFocusId: (id: string | null) => void;
  /** Panels can ask the map to fly somewhere (e.g. a highlight card click). */
  flyTo: [number, number] | null; setFlyTo: (p: [number, number] | null) => void;
}

const Ctx = createContext<MapState | null>(null);
export const DEFAULT_YEAR = 2034;

export function MapProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<PublicFeature[] | null>(null);
  const [view, setView] = useState<PublicFeature[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [future, setFuture] = useState(false);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [playing, setPlaying] = useState(false);
  const [lens, setLens] = useState<Lens>("places");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [highlights, setHighlights] = useState<MapHighlight[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const v = useMemo<MapState>(() => ({ features, setFeatures, view, setView, selectedId, setSelectedId, future, setFuture, year, setYear, playing, setPlaying, lens, setLens, scenario, setScenario, highlights, setHighlights, focusId, setFocusId, flyTo, setFlyTo }),
    [features, view, selectedId, future, year, playing, lens, scenario, highlights, focusId, flyTo]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

/** Map state; outside a provider (isolated component tests) a harmless stand-in is returned. */
export function useMapState(): MapState {
  const c = useContext(Ctx);
  if (c) return c;
  const noop = () => undefined;
  return { features: null, setFeatures: noop, view: null, setView: noop, selectedId: null, setSelectedId: noop, future: false, setFuture: noop, year: DEFAULT_YEAR, setYear: noop, playing: false, setPlaying: noop, lens: "places", setLens: noop, scenario: null, setScenario: noop, highlights: null, setHighlights: noop, focusId: null, setFocusId: noop, flyTo: null, setFlyTo: noop };
}
