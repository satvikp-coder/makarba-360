/**
 * SYNTHETIC TEST DATA ONLY. These are not residents and not real recollections; the text says so, the locality is invented,
 * and nothing here is imported by application code or published. Never move this under data/.
 */
import type { CommunityEntryInput, CommunityTheme } from "../communityModel.js";

export const AS_OF = "2026-11-22";
const WORD: Record<string, string> = { "transport-access": "travel", "development-benefits": "gains", "development-costs": "losses", livelihoods: "work", "heritage-connection": "heritage" };

export function entry(theme: CommunityTheme, n: number, over: Partial<CommunityEntryInput> = {}): CommunityEntryInput {
  return {
    id: `syn-${theme}-${n}`, theme,
    period: { kind: "before-after", beforeYear: 2005, afterYear: 2020 },
    perspective: (["positive", "mixed", "negative", "neutral", "mixed"] as const)[n % 5]!,
    text: `Synthetic test recollection ${n} about ${WORD[theme] ?? "change"}, written for automated tests only.`,
    textKind: "paraphrase",
    consent: { consentId: `SYN-CONSENT-${theme}-${n}`, publicationScope: "public", withdrawn: false, consentedOn: "2026-03-01", approverRole: "data-steward" },
    provenance: { method: "interview", collectedOn: "2026-03-01", locality: "Synthetic Test Ward" },
    ...over,
  };
}
export const group = (theme: CommunityTheme, n = 5) => Array.from({ length: n }, (_, i) => entry(theme, i + 1));
/** 15 entries: three themes of five separate consents in one invented locality. */
export const publishable = () => [...group("transport-access"), ...group("development-benefits"), ...group("development-costs")];
