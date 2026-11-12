/** Deterministic, explainable signals from the forecast file for a chosen end year. No model, no network. */

export interface Point { year: number; value: number; lo?: number; hi?: number }
export interface Series { id: string; label: string; theme: string; unit: string; good?: "up" | "down" | null; history: Point[]; forecast: Point[] }
export interface ForecastDoc { generated: string; model: string; maxYear: number; region: string; source: string; disclaimer: string; series: Series[] }

export type Momentum = "accelerating" | "slowing" | "reversing" | "steady";
export type Verdict = "improving" | "worsening" | "neutral";
export interface Signal {
  s: Series; from: Point; to: Point; change: number; pct: number | null;
  momentum: Momentum; verdict: Verdict; confidence: "high" | "medium" | "low"; implication: string;
}

/** History plus the forecast truncated at endYear (TimesFM decodes the horizon in one pass, so a prefix is exact). */
export function upTo(s: Series, endYear: number): Series {
  return { ...s, forecast: s.forecast.filter((p) => p.year <= endYear) };
}

/** Average yearly change over the last `n` points. */
const slope = (pts: Point[], n: number) => {
  const a = pts.slice(-n - 1);
  return a.length < 2 ? 0 : (a[a.length - 1]!.value - a[0]!.value) / (a.length - 1);
};

export function signal(s: Series, endYear: number): Signal | null {
  const f = upTo(s, endYear).forecast;
  const from = s.history[s.history.length - 1], to = f[f.length - 1];
  if (!from || !to) return null;
  const change = to.value - from.value;
  const pct = from.value !== 0 && !s.unit.startsWith("WGI") ? (change / Math.abs(from.value)) * 100 : null;
  const past = slope(s.history, 10), ahead = slope([from, ...f], f.length);
  const scale = Math.max(Math.abs(past), Math.abs(ahead), 1e-9);
  const momentum: Momentum = Math.sign(past) !== Math.sign(ahead) && Math.abs(past) / scale > 0.15 && Math.abs(ahead) / scale > 0.15 ? "reversing"
    : Math.abs(ahead) > Math.abs(past) * 1.25 ? "accelerating" : Math.abs(ahead) < Math.abs(past) * 0.75 ? "slowing" : "steady";
  // A move smaller than 2% of the level (or 0.05 WGI points) is noise, not a verdict.
  const meaningful = Math.abs(change) > Math.max(Math.abs(from.value) * 0.02, s.unit.startsWith("WGI") ? 0.05 : 0);
  const verdict: Verdict = !s.good || !meaningful ? "neutral" : (change > 0) === (s.good === "up") ? "improving" : "worsening";
  const spread = to.hi !== undefined && to.lo !== undefined ? (to.hi - to.lo) / Math.max(Math.abs(to.value), Math.abs(change), 1e-9) : 0;
  const confidence = spread < 0.25 ? "high" : spread < 0.75 ? "medium" : "low";
  return { s, from, to, change, pct, momentum, verdict, confidence, implication: implicationFor(s.id, change) };
}

export function signals(doc: ForecastDoc, endYear: number): Signal[] {
  return doc.series.map((s) => signal(s, endYear)).filter((x): x is Signal => x !== null);
}

/**
 * What a national trend would mean for a fast-growing peri-urban ward like Makarba. These are interpretations
 * of the direction of a national series, not local findings, and the UI labels them that way.
 */
const IMPLICATIONS: Record<string, [up: string, down: string]> = {
  "NY.GDP.PCAP.CD": ["Rising incomes push demand for housing, retail and private vehicles along arterial roads.", "Falling incomes slow new construction and household spending."],
  "NY.GDP.MKTP.KD.ZG": ["Faster growth tends to pull more commercial development to the city edge.", "Slower growth delays planned commercial and residential projects."],
  "FP.CPI.TOTL.ZG": ["Higher inflation squeezes household budgets and raises rents.", "Easing inflation relieves pressure on rents and daily costs."],
  "SL.UEM.TOTL.ZS": ["More unemployment means more informal work and pressure on street-vending space.", "Falling unemployment raises demand for commuting and services."],
  "SL.UEM.1524.ZS": ["Young people out of work increase demand for training and public spaces.", "More young people in work raises demand for affordable rentals near job centres."],
  "BX.KLT.DINV.WD.GD.ZS": ["More foreign investment favours new offices and logistics near highway corridors.", "Less foreign investment slows large private projects."],
  "NE.GDI.TOTL.ZS": ["Higher investment means more construction activity, dust and traffic during build-out.", "Lower investment slows infrastructure upgrades."],
  "NV.IND.MANF.ZS": ["A larger manufacturing share brings industrial jobs and freight traffic.", "A shrinking manufacturing share shifts local jobs towards services."],
  "NV.SRV.TOTL.ZS": ["A growing services share means more offices, shops and delivery traffic.", "A shrinking services share reduces office demand."],
  "SP.POP.TOTL": ["More people overall add pressure on water, schools and transport.", "A shrinking population eases pressure on services."],
  "SP.URB.TOTL.IN.ZS": ["Urbanisation keeps converting the city edge into dense housing; water, drainage and transit need to keep up.", "Slower urbanisation eases land conversion at the city edge."],
  "SP.URB.GROW": ["Faster urban growth intensifies demand for housing and roads.", "Slower urban growth gives infrastructure time to catch up."],
  "EG.ELC.ACCS.ZS": ["Near-universal electricity supports home businesses and digital services.", "Gaps in electricity access hold back home businesses."],
  "IT.NET.USER.ZS": ["Wider internet use shifts shopping and services online and raises delivery traffic.", "Lower internet use limits access to digital services."],
  "IT.CEL.SETS.P2": ["More mobile connections deepen digital payments and app-based work.", "Fewer mobile connections narrow digital access."],
  "EG.FEC.RNEW.ZS": ["A rising renewable share favours rooftop solar and EV charging points.", "A falling renewable share keeps reliance on fossil fuels."],
  "EN.ATM.PM25.MC.M3": ["Worse air quality raises health risks for people near busy roads.", "Cleaner air improves health for residents near busy roads."],
  "EG.USE.ELEC.KH.PC": ["Higher electricity use per person raises peak summer load on local supply.", "Lower electricity use eases peak load."],
  "SP.DYN.LE00.IN": ["Longer lives increase demand for clinics and accessible streets.", "Falling life expectancy signals health-system strain."],
  "SH.DYN.MORT": ["Rising child mortality points to gaps in maternal and child health services.", "Falling child mortality reflects better health services."],
  "SP.DYN.TFRT.IN": ["Higher fertility increases future school demand.", "Lower fertility means smaller households and, over time, fewer new school places needed."],
  "SP.POP.65UP.TO.ZS": ["An ageing population needs step-free streets, seating and nearby healthcare.", "A younger population needs more schools and play space."],
  "SE.SEC.ENRR": ["More secondary enrolment raises demand for schools and safe routes to school.", "Lower enrolment raises dropout risk."],
  "SE.TER.ENRR": ["More college enrolment raises demand for student housing and transit to campuses.", "Lower college enrolment reduces student housing demand."],
  "SL.TLF.CACT.FE.ZS": ["More women in work increases demand for safe transit, lighting and childcare.", "Fewer women in work reduces household incomes."],
  "SH.XPD.CHEX.GD.ZS": ["More health spending supports new clinics and diagnostics.", "Less health spending strains public clinics."],
  "KAGGLE_AHD_PM2.5": ["More fine particulates in Ahmedabad's air: more respiratory illness, especially beside the highway.", "Cleaner Ahmedabad air: fewer respiratory illnesses near busy roads."],
  "KAGGLE_AHD_PM10": ["More coarse dust in Ahmedabad: typical of construction-heavy growth.", "Less coarse dust as construction and road dust are controlled."],
  "KAGGLE_AHD_NO2": ["More traffic exhaust in Ahmedabad: the case for BRTS/metro feeders and EVs grows.", "Less traffic exhaust as vehicles get cleaner or trips shift to transit."],
  "KAGGLE_AHD_AQI": ["Worse overall air in Ahmedabad: more days unsafe for outdoor activity.", "Better overall air in Ahmedabad: more days safe for outdoor activity."],
  "GOV_WGI_PV.EST": ["Greater stability supports long-term investment.", "Lower stability makes investors and residents more cautious."],
  "GOV_WGI_GE.EST": ["More effective government means faster delivery of roads, water and permits.", "Less effective government delays civic works."],
  "GOV_WGI_RL.EST": ["A stronger rule of law gives clearer land titles and fewer disputes.", "A weaker rule of law raises land and property disputes."],
  "GOV_WGI_CC.EST": ["Better control of corruption makes permits and services fairer.", "Weaker control of corruption raises the cost of permits and services."],
  "GOV_WGI_VA.EST": ["More voice and accountability strengthens resident participation in planning.", "Less voice and accountability weakens public consultation."],
  "GOV_WGI_RQ.EST": ["Better regulation eases business formation and construction approvals.", "Worse regulation slows approvals."],
};

export function implicationFor(id: string, change: number): string {
  const pair = IMPLICATIONS[id];
  return pair ? pair[change >= 0 ? 0 : 1] : "";
}

export const fmt = (v: number | undefined | null) => v === undefined || v === null ? "–" : Math.abs(v) >= 1e7 ? `${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 1 })} crore` : v.toLocaleString("en-IN", { maximumSignificantDigits: 4 });
