import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { parseStories } from "./stories.js";
import { Voices } from "./Voices.js";

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "../../docs/project/contracts/proposed/stories-fixture.json"), "utf8"));
type Doc = { stories: { blocks: Record<string, unknown>[] }[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const res = (b: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(b), { status: s }));
const show = (f: typeof fetch) => render(<MemoryRouter><Voices fetcher={f} /></MemoryRouter>);
afterEach(cleanup);

describe("parseStories (strict, proposed contract)", () => {
  it("accepts the synthetic fixture", () => { expect(parseStories(fixture)?.stories).toHaveLength(1); });
  it("rejects forbidden private fields anywhere, an unknown label, extra keys, empty blocks and bad envelopes", () => {
    const leak = clone(fixture); leak.stories[0].blocks[1].interviewLatitude = 10;
    expect(parseStories(leak)).toBeNull();
    const authorLeak = clone(fixture); authorLeak.stories[0].researcherId = "x";
    expect(parseStories(authorLeak)).toBeNull();
    expect(parseStories({ stories: [], meta: { datasetKind: "maybe" } })).toBeNull();
    expect(parseStories({ meta: fixture.meta })).toBeNull();
    expect(parseStories(null)).toBeNull();
  });
  it("drops a whole story if any block is invalid, rather than showing part of it", () => {
    for (const mutate of [
      (f: Doc) => { f.stories[0]!.blocks[0]!.label = "Proven"; },
      (f: Doc) => { f.stories[0]!.blocks[1]!.consentPublish = "granted"; },
      (f: Doc) => { delete f.stories[0]!.blocks[2]!.scope; },
      (f: Doc) => { f.stories[0]!.blocks[1]!.quote = "  "; },
      (f: Doc) => { f.stories[0]!.blocks = []; },
    ]) { const f = clone(fixture); mutate(f); expect(parseStories(f)?.stories, JSON.stringify(f.stories[0]?.blocks[0])).toEqual([]); }
  });
});

describe("Community Voices page", () => {
  it("shows each block with its own label, the memory marked as memory, the official statement with body, date and scope", async () => {
    const { container } = show((() => res(fixture)) as unknown as typeof fetch);
    expect(await screen.findByRole("heading", { level: 2, name: "Synthetic test story" })).toBeTruthy();
    const t = container.textContent!;
    for (const x of ["Verified fact", "What a person remembers", "Official statement", "a long-time shopkeeper", "This is one person's memory, not a verified fact", "Synthetic Ward Office", "2026-03-01", "statement about the lake works"]) expect(t).toContain(x);
    expect(t).not.toContain("composite, fictional");
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("a memory without permitted attribution shows no name or role", async () => {
    const f = clone(fixture); f.stories[0].blocks[1].attribution = null;
    const { container } = show((() => res(f)) as unknown as typeof fetch);
    await screen.findByText("Invented remembered words for testing.");
    expect(container.textContent).not.toContain("shopkeeper");
  });
  it("withdrawal: when the next load no longer contains the story, it is gone", async () => {
    let call = 0;
    const f = (() => res(++call === 1 ? fixture : { ...fixture, stories: [] })) as unknown as typeof fetch;
    const first = show(f);
    await screen.findByText("Invented remembered words for testing.");
    first.unmount();
    show(f);
    expect(await screen.findByText("No community accounts have been approved for publication yet.")).toBeTruthy();
    expect(screen.queryByText("Invented remembered words for testing.")).toBeNull();
  });
  it("requests the stories endpoint fresh (no-store, no credentials) and nothing else", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    show(((u: string, init?: RequestInit) => { seen.push({ url: u, init }); return res(fixture); }) as unknown as typeof fetch);
    await screen.findByText("Invented remembered words for testing.");
    expect(seen.map((s) => s.url)).toEqual(["/api/v1/public/stories"]);
    expect(seen[0]!.init).toMatchObject({ cache: "no-store", credentials: "omit" });
  });
  it("404 is the honest empty state; invalid payloads and server errors show nothing from the payload", async () => {
    show((() => res({}, 404)) as unknown as typeof fetch);
    expect(await screen.findByText("No community accounts have been approved for publication yet.")).toBeTruthy();
    cleanup();
    const bad = clone(fixture); bad.stories[0].blocks[1].participantName = "x";
    show((() => res(bad)) as unknown as typeof fetch);
    expect(await screen.findByText(/did not pass validation, so none are shown/)).toBeTruthy();
    expect(screen.queryByText("Invented remembered words for testing.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    cleanup();
    show((() => res({}, 503)) as unknown as typeof fetch);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("hostile text is rendered as text", async () => {
    const f = clone(fixture); f.stories[0].blocks[0].text = `<img src=x onerror="window.__v=1"><script>1</script>`;
    const { container } = show((() => res(f)) as unknown as typeof fetch);
    await waitFor(() => expect(container.textContent).toContain("onerror"));
    expect(container.querySelectorAll("script,[onerror]")).toHaveLength(0);
  });
});
