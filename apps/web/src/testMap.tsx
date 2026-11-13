import type { ReactNode } from "react";
import { MapProvider, useMapState } from "./mapCtx.js";
import { MapView } from "./map/MapView.js";

/** Test helper: the shared map state plus a MapView fed from it (as the Stage does), so tests can assert what reaches the map. */
function MapFromState() {
  const m = useMapState();
  const f = m.view ?? m.features;
  return f ? <MapView features={f} selectedId={m.selectedId} sourceAttribution="test" onSelect={m.setSelectedId} /> : null;
}
export const WithMap = ({ children }: { children: ReactNode }) => <MapProvider>{children}<MapFromState /></MapProvider>;
