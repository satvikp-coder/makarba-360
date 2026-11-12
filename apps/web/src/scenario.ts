import { fmt, signals, type ForecastDoc, type Signal } from "./outlook.js";

/**
 * Illustrative "what could change" scene for the 3D map, derived from national forecasts.
 * Each factor is a simple, stated mapping from one indicator to one visible change, so the map never implies more
 * precision than the forecast has. Nothing here is a plan, a projection for Makarba, or a measurement.
 */
export interface Scenario {
  year: number;
  /** Height multiplier for buildings along the highway corridor (commercial pressure). */
  corridorGrowth: number;
  /** Height multiplier for the rest of the built-up area (densification). */
  densify: number;
  /** Share of plots redeveloped into new mid/high-rise blocks, 0..0.8. */
  redevelop: number;
  /** Share of rooftops with solar, 0..0.6. */
  solar: number;
  /** Haze overlay opacity, 0..0.55. */
  haze: number;
  /** Traffic intensity multiplier on the highway animation. */
  traffic: number;
  /** Human-readable explanation of every change, in the order shown on the map. */
  changes: { id: string; title: string; because: string; effect: string }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const by = (sig: Signal[], id: string) => sig.find((x) => x.s.id === id);
const pts = (x: Signal | undefined) => (x ? x.change : 0);
const pct = (x: Signal | undefined) => (x?.pct ?? 0);

export const NEUTRAL: Scenario = { year: 0, corridorGrowth: 1, densify: 1, redevelop: 0, solar: 0, haze: 0, traffic: 1, changes: [] };

export function scenarioFor(doc: ForecastDoc, endYear: number): Scenario {
  const sig = signals(doc, endYear);
  const gdp = by(sig, "NY.GDP.PCAP.CD"), urban = by(sig, "SP.URB.TOTL.IN.ZS"), fdi = by(sig, "NE.GDI.TOTL.ZS");
  const solarS = by(sig, "EG.FEC.RNEW.ZS"), pm = by(sig, "KAGGLE_AHD_PM2.5") ?? by(sig, "EN.ATM.PM25.MC.M3"), pop = by(sig, "SP.POP.TOTL");
  const corridorGrowth = clamp(1 + pct(gdp) / 120, 0.85, 2.2);
  const densify = clamp(1 + pts(urban) * 0.04, 0.9, 1.6);
  const redevelop = clamp((pct(gdp) / 100) * 0.35 + pts(fdi) * 0.02, 0, 0.8);
  // Rooftop PV is a small slice of the renewable share (most is hydro, wind and biomass): roughly a quarter, plus growth.
  const solar = clamp((solarS ? solarS.to.value : 0) / 400 + Math.max(0, pts(solarS)) / 60, 0, 0.6);
  const haze = clamp(pm ? pm.to.value / 160 : 0, 0, 0.55);
  const traffic = clamp(1 + pct(gdp) / 200 + pct(pop) / 50, 0.8, 2.2);
  const changes: Scenario["changes"] = [];
  const pc = (x: Signal | undefined) => (x?.pct === null || x?.pct === undefined ? "" : ` (${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(0)}%)`);
  if (gdp) changes.push({ id: "corridor", title: "Taller commercial corridor", because: `GDP per capita ${fmt(gdp.from.value)} → ${fmt(gdp.to.value)} US$${pc(gdp)}`,
    effect: `Highway-side buildings ×${corridorGrowth.toFixed(2)} height: higher incomes typically pull offices, malls and hotels to arterial roads.` });
  if (gdp || fdi) changes.push({ id: "redevelop", title: "Plots redeveloped", because: `${gdp ? "Income growth" : ""}${gdp && fdi ? " and " : ""}${fdi ? `investment at ${fmt(fdi.to.value)}% of GDP` : ""}`,
    effect: `${Math.round(redevelop * 100)}% of low-rise plots shown rebuilt as mid-rise blocks (highlighted).` });
  if (urban) changes.push({ id: "densify", title: "Denser neighbourhoods", because: `Urban share ${fmt(urban.from.value)}% → ${fmt(urban.to.value)}%`,
    effect: `Residential blocks ×${densify.toFixed(2)} height: more people living in cities means more floors on the same land.` });
  if (solarS) changes.push({ id: "solar", title: "Rooftop solar", because: `Renewable share ${fmt(solarS.from.value)}% → ${fmt(solarS.to.value)}%`,
    effect: `${Math.round(solar * 100)}% of rooftops shown with solar panels (blue roofs).` });
  if (pm) changes.push({ id: "haze", title: "Air quality", because: `${pm.s.id.startsWith("KAGGLE") ? "Ahmedabad" : "National"} PM2.5 ${fmt(pm.from.value)} → ${fmt(pm.to.value)} µg/m³`,
    effect: pm.to.value > 35 ? "Visible haze: still well above the WHO guideline of 5 µg/m³." : "Lighter haze as particulate levels fall." });
  if (gdp || pop) changes.push({ id: "traffic", title: "Traffic", because: `${gdp ? "Incomes" : ""}${gdp && pop ? " and " : ""}${pop ? "population" : ""} growth`,
    effect: `Highway traffic ×${traffic.toFixed(2)}: more vehicles unless public transport keeps pace.` });
  return { year: endYear, corridorGrowth, densify, redevelop, solar, haze, traffic, changes };
}
