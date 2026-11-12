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
  /** Traffic intensity multiplier: number and speed of vehicles. */
  traffic: number;
  /** Heat shimmer strength from Ahmedabad's forecast hot days, 0..1. */
  heat: number;
  /** Human-readable explanation of every change, in the order shown on the map. */
  changes: { id: string; title: string; because: string; effect: string; at: [number, number] }[];
}

/** Fixed places on the 3D map that highlights (including AI-generated ones) may point at. */
export const ANCHORS = {
  corridor: { at: [72.5141, 22.9985] as [number, number], label: "highway-side commercial corridor" },
  redevelop: { at: [72.509, 22.9978] as [number, number], label: "older plots north of the village" },
  densify: { at: [72.4985, 22.9835] as [number, number], label: "residential neighbourhoods to the south-west" },
  solar: { at: [72.4975, 22.9925] as [number, number], label: "rooftops of low-rise homes" },
  haze: { at: [72.5055, 23.0015] as [number, number], label: "the sky over the ward (air quality)" },
  traffic: { at: [72.5121, 22.9855], label: "Sarkhej–Gandhinagar Highway traffic" } as { at: [number, number]; label: string },
  heat: { at: [72.5005, 22.9805] as [number, number], label: "streets and open ground in summer heat" },
  roza: { at: [72.5045, 22.9923] as [number, number], label: "Sarkhej Roza heritage complex" },
  lake: { at: [72.5035, 22.9897] as [number, number], label: "Sarkhej lake and its steps" },
  canal: { at: [72.511, 22.9968] as [number, number], label: "canal bank" },
  mill: { at: [72.5168, 22.992] as [number, number], label: "former mill compound" },
  market: { at: [72.5155, 22.9975] as [number, number], label: "factory-road vending stretch" },
  junction: { at: [72.5062, 22.9936] as [number, number], label: "junction by the shrine approach" },
};
export type AnchorId = keyof typeof ANCHORS;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const by = (sig: Signal[], id: string) => sig.find((x) => x.s.id === id);
const pts = (x: Signal | undefined) => (x ? x.change : 0);
const pct = (x: Signal | undefined) => (x?.pct ?? 0);

export const NEUTRAL: Scenario = { year: 0, corridorGrowth: 1, densify: 1, redevelop: 0, solar: 0, haze: 0, traffic: 1, heat: 0, changes: [] };

export function scenarioFor(doc: ForecastDoc, endYear: number): Scenario {
  const sig = signals(doc, endYear);
  const gdp = by(sig, "NY.GDP.PCAP.CD"), urban = by(sig, "SP.URB.TOTL.IN.ZS"), fdi = by(sig, "NE.GDI.TOTL.ZS");
  const solarS = by(sig, "EG.FEC.RNEW.ZS"), pm = by(sig, "KAGGLE_AHD_PM2.5") ?? by(sig, "EN.ATM.PM25.MC.M3"), pop = by(sig, "SP.POP.TOTL");
  const hot = by(sig, "WEATHER_AHD_HOTDAYS");
  const corridorGrowth = clamp(1 + pct(gdp) / 120, 0.85, 2.2);
  const densify = clamp(1 + pts(urban) * 0.04, 0.9, 1.6);
  const redevelop = clamp((pct(gdp) / 100) * 0.35 + pts(fdi) * 0.02, 0, 0.8);
  // Rooftop PV is a small slice of the renewable share (most is hydro, wind and biomass): roughly a quarter, plus growth.
  const solar = clamp((solarS ? solarS.to.value : 0) / 400 + Math.max(0, pts(solarS)) / 60, 0, 0.6);
  const haze = clamp(pm ? pm.to.value / 160 : 0, 0, 0.55);
  const traffic = clamp(1 + pct(gdp) / 200 + pct(pop) / 50, 0.8, 2.2);
  // Heat: 0 at 30 hot days a year, full shimmer at 110.
  const heat = clamp(hot ? (hot.to.value - 30) / 80 : 0, 0, 1);
  const changes: Scenario["changes"] = [];
  const pc = (x: Signal | undefined) => (x?.pct === null || x?.pct === undefined ? "" : ` (${x.pct >= 0 ? "+" : ""}${x.pct.toFixed(0)}%)`);
  const taller = (k: number) => (Math.abs(k - 1) < 0.01 ? "about the same height" : `about ${Math.round(Math.abs(k - 1) * 100)}% ${k > 1 ? "taller" : "lower"}`);
  if (gdp) changes.push({ id: "corridor", at: ANCHORS.corridor.at, title: "Highway corridor grows", because: `GDP per person ${fmt(gdp.from.value)} → ${fmt(gdp.to.value)} US$${pc(gdp)}`,
    effect: `Buildings along the highway become ${taller(corridorGrowth)}. Richer households draw offices, shops and hotels to main roads.` });
  if (gdp || fdi) changes.push({ id: "redevelop", at: ANCHORS.redevelop.at, title: "Old plots rebuilt", because: `${gdp ? "Income growth" : ""}${gdp && fdi ? " and " : ""}${fdi ? `investment at ${fmt(fdi.to.value)}% of GDP` : ""}`,
    effect: `About ${Math.round(redevelop * 100)} in 100 low-rise plots are rebuilt as taller blocks (orange).` });
  if (urban) changes.push({ id: "densify", at: ANCHORS.densify.at, title: "Neighbourhoods fill up", because: `Share of Indians in cities ${fmt(urban.from.value)}% → ${fmt(urban.to.value)}%`,
    effect: `Homes become ${taller(densify)}: more people in cities means more floors on the same land.` });
  if (solarS) changes.push({ id: "solar", at: ANCHORS.solar.at, title: "Solar on rooftops", because: `Renewable energy ${fmt(solarS.from.value)}% → ${fmt(solarS.to.value)}% of use`,
    effect: `About ${Math.round(solar * 100)} in 100 rooftops get solar panels (blue).` });
  if (pm) changes.push({ id: "haze", at: ANCHORS.haze.at, title: pm.change > 0 ? "Hazier air" : "Clearer air", because: `${pm.s.id.startsWith("KAGGLE") ? "Ahmedabad" : "National"} PM2.5 ${fmt(pm.from.value)} → ${fmt(pm.to.value)} µg/m³`,
    effect: pm.to.value > 35 ? "The haze over the map thickens. Still far above the WHO guideline of 5 µg/m³." : "The haze over the map thins as particulate levels fall." });
  if (gdp || pop) changes.push({ id: "traffic", at: ANCHORS.traffic.at, title: "Busier highway", because: `${gdp ? "Incomes" : ""}${gdp && pop ? " and " : ""}${pop ? "population" : ""} rise`,
    effect: `Traffic on the highway moves ${traffic >= 1 ? `${Math.round((traffic - 1) * 100)}% busier` : "lighter"}: more vehicles unless public transport keeps pace.` });
  if (hot) changes.push({ id: "heat", at: ANCHORS.heat.at, title: hot.change > 0 ? "Hotter summers" : "Milder summers", because: `Ahmedabad days at or above 40 °C ${fmt(hot.from.value)} → ${fmt(hot.to.value)} a year`,
    effect: hot.change > 0 ? "Heat shimmer over open ground: shade, cool roofs and water points matter more." : "Less heat shimmer as very hot days become rarer." });
  return { year: endYear, corridorGrowth, densify, redevelop, solar, haze, traffic, heat, changes };
}
