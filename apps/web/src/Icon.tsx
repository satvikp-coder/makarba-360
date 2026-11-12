/**
 * One hairline icon family for the whole site: 24px grid, 1.5px round strokes, currentColor, no fills.
 * Decorative only: the control that carries an icon always supplies its own accessible name.
 */
const PATHS = {
  // navigation
  home: "M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9.5z",
  map: "M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zm0 0v14m6-12v14",
  trend: "M3 17l5.5-5.5 4 4L21 7m0 0h-5m5 0v5",
  history: "M12 7v5l3 2M4.5 12a7.5 7.5 0 107.5-7.5A7.5 7.5 0 005.7 8M4 4v4.5h4.5",
  voices: "M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-7l-4 3.5V16H5a1 1 0 01-1-1V6a1 1 0 011-1zm4 5h.01M12 10h.01M15 10h.01",
  insights: "M4 20h16M7 17v-6m5 6V6m5 11v-8",
  research: "M5 4.5h9a3 3 0 013 3V20H8a3 3 0 01-3-3V4.5zm0 12.5a3 3 0 013-3h9M9 8.5h4",
  // shell
  settings: "M4 7h10m4 0h2M4 17h4m4 0h8M16 5v4m-6 6v4",
  keyboard: "M3.5 7h17a1 1 0 011 1v9a1 1 0 01-1 1h-17a1 1 0 01-1-1V8a1 1 0 011-1zM7 11h.01M11 11h.01M15 11h.01M17.5 14.5h-11",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zm9.5-3a3 3 0 100 6 3 3 0 000-6z",
  contrast: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-18v18",
  text: "M4 19l5-14 5 14M5.8 14h6.4M15.5 19l3-8 3 8m-5.2-2.6h4.4",
  palette: "M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.5-1-2.7 0-1 .8-1.7 1.8-1.7H17a4 4 0 004-4C21 6.4 17 3 12 3zM7.5 12h.01M9 7.5h.01M14 6.5h.01M17.5 9.5h.01",
  motion: "M3 12h4l2.5-6 5 12 2.5-6h4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-10v5.5M12 7.5v.5",
  close: "M6 6l12 12M18 6L6 18",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  arrowUR: "M7 17L17 7m0 0H9m8 0v8",
  check: "M5 12.5l4.5 4.5L19 7.5",
  // map controls
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18zm3.5-12.5L13.4 13.4 8.5 15.5l2.1-4.9 4.9-2.1z",
  north: "M12 3l5 16-5-3.5L7 19l5-16z",
  locate: "M12 15a3 3 0 100-6 3 3 0 000 6zm0-12v3m0 12v3M3 12h3m12 0h3",
  tilt: "M4 18l8-12 8 12M7.5 13h9",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18m8-13.5L12 12 4 7.5",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4m0-12.8L17 7m-10 10l-1.4 1.4",
  sunrise: "M3 18h18M7 18a5 5 0 0110 0M12 4v5m-7.1 1.9l1.4 1.4m13.6-1.4l-1.4 1.4M9 7l3-3 3 3",
  sunset: "M3 18h18M7 18a5 5 0 0110 0M12 9V4m-7.1 6.9l1.4 1.4m13.6-1.4l-1.4 1.4M9 6l3 3 3-3",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  pause: "M9 5v14M15 5v14",
  play: "M7 4.5v15l12-7.5-12-7.5z",
  replay: "M4 12a8 8 0 108-8H8M8 4l-3 3 3 3",
  route: "M6 19a2 2 0 100-4 2 2 0 000 4zm12-10a2 2 0 100-4 2 2 0 000 4zM6 15V9a3 3 0 013-3h3m0 12h3a3 3 0 003-3V9",
  camera: "M3 8.5A1.5 1.5 0 014.5 7h2.3l1.5-2h7.4l1.5 2h2.3A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-9zM12 10a3 3 0 100 6 3 3 0 000-6z",
  orbit: "M12 14a2 2 0 100-4 2 2 0 000 4zm9-2c0 2.2-4 4-9 4s-9-1.8-9-4 4-4 9-4c2.6 0 4.9.5 6.5 1.3M17 7l1.6 2.3L16 10",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zm7 12l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  layers: "M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5",
  chart: "M4 19h16M7 16V11m5 5V7m5 9v-4",
  // topics (used by generative highlights)
  building: "M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16m0-10h4a1 1 0 011 1v9M3 21h18M8 8h3m-3 4h3m-3 4h3",
  home2: "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  car: "M5 16.5V12l2-5h10l2 5v4.5M5 16.5h14M5 16.5V19m14-2.5V19M7.5 13.5h.01M16.5 13.5h.01M5 12h14",
  bus: "M6 4h12a1 1 0 011 1v12H5V5a1 1 0 011-1zm-1 9h14M8 17v2.5m8-2.5v2.5M8.5 15h.01M15.5 15h.01",
  thermo: "M12 14.5V5a2 2 0 10-4 0v9.5a4 4 0 104 0zM10 11v6",
  drop: "M12 3.5s6 6.4 6 10.5a6 6 0 01-12 0c0-4.1 6-10.5 6-10.5z",
  leaf: "M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l6-6",
  bolt: "M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 9a6 6 0 0112 0m2-9a3 3 0 10-1.5-5.6M21 20a5 5 0 00-4-4.9",
  coins: "M9 10c3.3 0 6-1.1 6-2.5S12.3 5 9 5 3 6.1 3 7.5 5.7 10 9 10zm-6-2.5v4C3 12.9 5.7 14 9 14s6-1.1 6-2.5m-12 0v4C3 16.9 5.7 18 9 18c1.1 0 2.1-.1 3-.4m3-4.6c3.3 0 6 1.1 6 2.5S18.3 18 15 18s-6-1.1-6-2.5",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3z",
  heart: "M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0112 7.2 4.5 4.5 0 0119.5 10c0 5.4-7.5 10-7.5 10z",
  wifi: "M3 9.5a13 13 0 0118 0M6 13a8 8 0 0112 0M9 16.5a3.5 3.5 0 016 0M12 20h.01",
  school: "M3 9l9-5 9 5-9 5-9-5zm3 2v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M21 9v6",
  factory: "M3 21V11l5 3v-3l5 3v-3l5 3V5h3v16H3zm4-4h2m4 0h2",
  haze: "M4 9h12a3 3 0 100-3M3 13h16a3 3 0 11-3 3M6 17h7",
  shop: "M4 9l1.5-5h13L20 9M4 9h16M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M5 9v11h14V9M10 20v-5h4v5",
  landmark: "M12 3c2.5 1.8 4 3.6 4 6H8c0-2.4 1.5-4.2 4-6zM6 9h12M7 9v9m10-9v9M4 21h16M10 13v5m4-5v5",
  water: "M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S18.5 15 21 15M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2-1.5 4.5-1.5S18.5 19 21 19M12 3s4 4.3 4 7a4 4 0 01-8 0c0-2.7 4-7 4-7z",
} as const;
export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
