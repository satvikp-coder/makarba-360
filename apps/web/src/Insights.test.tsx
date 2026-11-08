import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Insights } from "./Insights.js";

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/fixture-bundle.json"), "utf8"));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const res = (b: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(b), { status: s }));
const ok = ((url: string) => { void url; return res(bundle.insights); }) as unknown as typeof fetch;
const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname + l.search}</output>; };
const show = (f: typeof fetch = ok, url = "/insights") => render(<MemoryRouter initialEntries={[url]}><Insights fetcher={f} /><Where /></MemoryRouter>);
afterEach(cleanup);

describe("Insights tables", () => {
  it("shows an approved cohort with n, valid, unsure, missing, tables, period and policy metadata", async () => {
    const { container } = show();
    expect(await screen.findByRole("heading", { level: 2, name: "synthetic-safe" })).toBeTruthy();
    const t = container.textContent!;
    for (const x of ["People interviewed (n)", "40", "Valid answers", "30", "Unsure", "Missing or not answered", "Collected 2026-01 to 2026-02", "synthetic-survey-v1", "synthetic-disclosure-v1", "Respondent groups", "Reported issues"]) expect(t).toContain(x);
    expect(screen.getByRole("table", { name: /Ratings/ })).toBeTruthy();
    expect(screen.getByText(/Demonstration data/)).toBeTruthy();
  });
  it("a hidden group is stated as hidden and shows no figures, never zero", async () => {
    show();
    const h = await screen.findByRole("heading", { level: 2, name: "synthetic-small-independent" });
    const sec = h.closest("section")!;
    expect(sec.textContent).toContain("Hidden to protect privacy");
    expect(sec.textContent).toContain("This is not zero");
    expect(within(sec).queryAllByRole("table")).toHaveLength(0);
    expect(sec.textContent).not.toMatch(/\b0\b/);
    expect(screen.getByText(/1 group is hidden to protect privacy/)).toBeTruthy();
  });
  it("never shows an overall total and warns that groups overlap", async () => {
    const { container } = show();
    await screen.findByRole("heading", { level: 2, name: "synthetic-safe" });
    expect(container.textContent).toMatch(/must not be added together, and no overall total is shown/);
    expect(screen.queryByRole("row", { name: /total/i })).toBeNull();
  });
  it("the group selector shows only the approved groups, restricts the view and keeps state in the URL; unknown ids are ignored", async () => {
    const u = userEvent.setup();
    show();
    await screen.findByRole("heading", { level: 2, name: "synthetic-safe" });
    const sel = screen.getByRole("combobox", { name: /Group/ });
    expect(within(sel).getAllByRole("option").map((o) => o.textContent)).toEqual(["All approved groups", "synthetic-safe", "synthetic-small-independent (hidden)"]);
    await u.selectOptions(sel, "synthetic-small-independent");
    expect(screen.getByTestId("url").textContent).toBe("/insights?cohort=synthetic-small-independent");
    expect(screen.queryByRole("heading", { level: 2, name: "synthetic-safe" })).toBeNull();
    expect(screen.getByText(/Showing synthetic-small-independent/)).toBeTruthy();
    cleanup();
    show(ok, "/insights?cohort=%27%3B%20DROP%20TABLE");
    expect(await screen.findByText(/Showing all approved groups/)).toBeTruthy();
  });
  it("a payload that leaks counts for a suppressed group fails validation and nothing is shown", async () => {
    const bad = clone(bundle.insights); bad.cohorts[1].n = 2;
    show((() => res(bad)) as unknown as typeof fetch);
    expect(await screen.findByText(/did not pass validation, so nothing is shown/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("a cohort below the minimum size is rejected by validation rather than displayed", async () => {
    const bad = clone(bundle.insights); Object.assign(bad.cohorts[0], { n: 3, validAnswerN: 3, missingN: 0, unsureN: 0, ratings: [{ value: 3, count: 3 }] });
    show((() => res(bad)) as unknown as typeof fetch);
    expect(await screen.findByText(/did not pass validation/)).toBeTruthy();
  });
  it("empty, missing and server-error states are explicit and offer retry only when it can help", async () => {
    const empty = clone(bundle.insights); empty.cohorts = [];
    show((() => res(empty)) as unknown as typeof fetch);
    expect(await screen.findByText("No groups have been approved for display yet.")).toBeTruthy();
    cleanup();
    show((() => res({}, 404)) as unknown as typeof fetch);
    expect(await screen.findByText("No insights have been published yet.")).toBeTruthy();
    cleanup();
    show((() => res({}, 503)) as unknown as typeof fetch);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    cleanup();
    show((() => res({ junk: true })) as unknown as typeof fetch);
    expect(await screen.findByText(/did not pass validation/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
  it("makes only the public insights request, with no filter in it", async () => {
    const seen: string[] = [];
    show(((u: string) => { seen.push(u); return res(bundle.insights); }) as unknown as typeof fetch, "/insights?cohort=synthetic-safe");
    await screen.findByRole("heading", { level: 2, name: "synthetic-safe" });
    expect(seen).toEqual(["/api/v1/public/insights"]);
  });
  it("passes automated accessibility checks", async () => {
    const { container } = show();
    await screen.findByRole("heading", { level: 2, name: "synthetic-safe" });
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});
