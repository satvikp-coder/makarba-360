/** Hairline icon set (24px grid, 1.5px stroke, currentColor). Decorative: the control carrying it supplies the name. */
const PATHS = {
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18m8-13.5L12 12 4 7.5",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4m0-12.8L17 7m-10 10l-1.4 1.4",
  sunset: "M3 18h18M7 18a5 5 0 0110 0M12 4v5m-7.1 1.9l1.4 1.4m13.6-1.4l-1.4 1.4M9 7l3-3 3 3",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  pause: "M9 5v14M15 5v14",
  play: "M7 4.5v15l12-7.5-12-7.5z",
  replay: "M4 12a8 8 0 108-8H8M8 4l-3 3 3 3",
  route: "M6 19a2 2 0 100-4 2 2 0 000 4zm12-10a2 2 0 100-4 2 2 0 000 4zM6 15V9a3 3 0 013-3h3m0 12h3a3 3 0 003-3V9",
  camera: "M3 8.5A1.5 1.5 0 014.5 7h2.3l1.5-2h7.4l1.5 2h2.3A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-9zM12 10a3 3 0 100 6 3 3 0 000-6z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zm7 12l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  chart: "M4 19h16M7 16V11m5 5V7m5 9v-4",
  info: "M12 22a10 10 0 100-20 10 10 0 000 20zm0-11v6m0-9.5v.5",
  close: "M6 6l12 12M18 6L6 18",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  layers: "M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
