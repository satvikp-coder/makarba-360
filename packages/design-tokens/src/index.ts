import { passesAA, type TextUse } from "./contrast.js";
export * from "./contrast.js";

/** Brand palette from docs/design/design-system.md. */
export const palette = {
  ivory: "#F6F2E9",
  teal: "#163D3B",
  terracotta: "#D27A55",
  sandstone: "#E6BC6C",
  lake: "#4C91A3",
  // Status tokens chosen for AA on ivory (see contrast tests).
  errorText: "#9B1C1C",
  successText: "#1E5E34",
  white: "#FFFFFF",
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const radius = { panel: 8 } as const;
export const breakpoints = { compact: 768, desktop: 1200 } as const;
export const touchTarget = { preferred: 44 } as const;
export const motion = { panelMs: [160, 220] as const };
export const proseMaxWidth = "70ch";

/** Approved foreground/background pairs. Anything not listed is not approved for text. */
export const approvedPairs: ReadonlyArray<{ name: string; fg: string; bg: string; use: TextUse }> = [
  { name: "body", fg: palette.teal, bg: palette.ivory, use: "normal" },
  { name: "body-on-sandstone", fg: palette.teal, bg: palette.sandstone, use: "normal" },
  { name: "light-on-teal", fg: palette.ivory, bg: palette.teal, use: "normal" },
  { name: "error", fg: palette.errorText, bg: palette.ivory, use: "normal" },
  { name: "success", fg: palette.successText, bg: palette.ivory, use: "normal" },
  { name: "focus-ring-on-ivory", fg: palette.teal, bg: palette.ivory, use: "ui" },
  { name: "focus-ring-on-teal", fg: palette.sandstone, bg: palette.teal, use: "ui" },
];

/** Throws if a proposed text pairing is not AA; used by components and the design-token CI check. */
export function assertTextPair(fg: string, bg: string, use: TextUse): void {
  if (!passesAA(fg, bg, use)) throw new Error(`contrast failure: ${fg} on ${bg} is below AA for ${use} text`);
}

/** Accent colours are decoration only unless a tested pair exists. */
export const decorativeOnly = [palette.terracotta, palette.lake] as const;
