import { cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./map/MapView.js", () => ({ MapView: () => null }));
import { LANGUAGES } from "./i18n.js";
import { AccessibilityHelp, Methodology, Sources } from "./ResearchPages.js";
import { LANDMARKS } from "./landmarks.js";
import { App } from "./App.js";

afterEach(cleanup);
const pages = [["Methodology", Methodology], ["Sources", Sources], ["AccessibilityHelp", AccessibilityHelp]] as const;
const text = (C: () => React.ReactElement) => { const { container } = render(<MemoryRouter><C /></MemoryRouter>); return container.textContent ?? ""; };

describe("methodology, sources and accessibility pages", () => {
  it("methodology states sampling, counting, suppression and privacy limits and that nothing is a result", () => {
    const t = text(Methodology);
    for (const s of ["convenience and purposive", "not estimates for all residents", "counted once", "more than 100%", "not zero", "No data", "never published", "has not started"]) expect(t).toContain(s);
  });
  it("no invented team, contact, results or counts on any page", () => {
    for (const [, C] of pages) {
      const t = text(C);
      expect(t).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
      expect(t).not.toMatch(/mailto:|tel:|\+?\d[\d\s-]{8,}/);
      expect(t).not.toMatch(/\b(our team|meet the team|dr\.|prof\.)/i);
      expect(t).not.toMatch(/\b\d+\s+(respondents|interviews|residents|responses)\b/i);
      cleanup();
    }
  });
  it("sources describe the offline sketch basemap honestly, credit landmark sources and photos, and list no unapproved place sources", () => {
    const t = text(Sources);
    expect(t).toContain("approximate sketch of Makarba drawn for this project");
    expect(t).not.toContain("OpenStreetMap contributors");   // no OSM data is used any more, so it must not be credited as the base map
    expect(t).toContain("none are shown until their rights and dates have been checked");
    expect(screen.getByRole("link", { name: "Wikipedia: Sarkhej Roza" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Commons file page" }).length).toBe(LANDMARKS.flatMap((l) => l.photos ?? []).length);
    expect(t).toMatch(/CC BY-SA.*same licence/);
  });
  it("language claims match what the app actually offers", () => {
    const t = text(AccessibilityHelp);
    for (const l of LANGUAGES) {
      if (l.available) expect(t).toContain(`Available now: ${l.label}`);
      else expect(t).toContain(l.label);
    }
    expect(LANGUAGES.filter((l) => l.available).map((l) => l.code)).toEqual(["en"]);
    expect(t).toContain("not offered yet");
  });
  it("does not claim conformance or completed human review", () => {
    const t = text(AccessibilityHelp);
    expect(t).toMatch(/not.*yet been reviewed by people using screen readers/);
    expect(t).toContain("we do not claim full conformance");
    expect(t).not.toMatch(/fully (accessible|compliant)|WCAG 2\.\d (AA )?(compliant|conformant)/i);
  });
  it("routes render these pages with one h1 and pass automated accessibility checks", { timeout: 30_000 }, async () => {
    for (const path of ["/research/methodology", "/research/sources", "/accessibility"]) {
      const { container } = render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
      await waitFor(() => expect(container.querySelectorAll("h1")).toHaveLength(1));   // pages load lazily
      expect(screen.queryByText(/being built/)).toBeNull();
      const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(r.violations.map((v) => `${path}:${v.id}`)).toEqual([]);
      cleanup();
    }
  });
});
