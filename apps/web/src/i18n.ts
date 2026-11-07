/** Minimal externalised strings. Gujarati/Hindi are NOT offered until a human reviewer approves them (docs/design/accessibility.md). */
export type Lang = "en" | "gu" | "hi";
export const LANGUAGES: { code: Lang; label: string; available: boolean }[] = [
  { code: "en", label: "English", available: true },
  { code: "gu", label: "ગુજરાતી", available: false },
  { code: "hi", label: "हिन्दी", available: false },
];
export const en = {
  skip: "Skip to main content",
  siteName: "Makarba 360°",
  navLabel: "Main navigation",
  footerLabel: "Site information",
  language: "Language",
  languagePending: "translation pending review",
  loading: "Loading…",
  retry: "Try again",
  listTitle: "Places (list view)",
  listIntro: "A text list of published places. It has the same places as the map.",
  emptyPlaces: "No places have been published yet.",
  errorPlaces: "Places could not be loaded.",
  synthetic: "Demonstration data – not real Makarba observations",
  building: "This section is being built. Nothing is shown here yet.",
  notFound: "Page not found",
  homeLead: "An evidence-led atlas of Makarba, Ahmedabad: places, history and community findings.",
  homeCta: "Explore the map",
} as const;
export type Strings = typeof en;
export const strings: Record<Lang, Strings> = { en, gu: en, hi: en }; // labelled English fallback until reviewed
