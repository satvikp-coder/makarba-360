import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMUNITY_THEMES, MAX_TEXT, MIN_CELL_SIZE, fetchCommunity, findIdentifier, importCommunity, parsePublished, validateEntry, type CommunityEntryInput } from "./communityModel.js";
import { AS_OF, entry, group, publishable } from "./__fixtures__/communitySynthetic.js";

const errs = (e: unknown) => { const r = validateEntry(e, AS_OF); return r.ok ? [] : r.errors; };
const withConsent = (c: Record<string, unknown>) => ({ ...entry("livelihoods", 1), consent: { ...entry("livelihoods", 1).consent, ...c } });

describe("validateEntry: consent", () => {
  it("accepts a fully consented synthetic entry", () => expect(errs(entry("livelihoods", 1))).toEqual([]));
  it("rejects a missing consent record", () => { const rest: Record<string, unknown> = { ...entry("livelihoods", 1) }; delete rest["consent"]; expect(errs(rest).join()).toMatch(/consent record is missing/); });
  it("rejects withdrawn consent, and a withdrawn flag that is not explicit", () => {
    expect(errs(withConsent({ withdrawn: true })).join()).toMatch(/withdrawn/);
    expect(errs(withConsent({ withdrawn: undefined })).join()).toMatch(/never assumed/);
  });
  it("rejects scope withheld and unknown scopes", () => {
    expect(errs(withConsent({ publicationScope: "withheld" })).join()).toMatch(/withheld/);
    expect(errs(withConsent({ publicationScope: "everyone" })).join()).toMatch(/publicationScope/);
  });
  it("rejects expired consent: explicit expiry, and the default maximum age", () => {
    expect(errs(withConsent({ expiresOn: "2026-06-01" })).join()).toMatch(/expired/);
    expect(errs(withConsent({ consentedOn: "2023-01-01" })).join()).toMatch(/expired/);
    expect(errs(withConsent({ consentedOn: "2023-01-01", expiresOn: "2027-01-01" }))).toEqual([]);
  });
  it("rejects future and impossible consent dates and unknown approver roles", () => {
    expect(errs(withConsent({ consentedOn: "2027-01-01" })).join()).toMatch(/future/);
    expect(errs(withConsent({ consentedOn: "2026-02-31" })).join()).toMatch(/real date/);
    expect(errs(withConsent({ approverRole: "friend" })).join()).toMatch(/approverRole/);
  });
  it("an anonymised-summary scope may not carry a verbatim excerpt", () => {
    expect(errs({ ...withConsent({ publicationScope: "anonymised-summary" }), textKind: "excerpt" }).join()).toMatch(/paraphrase only/);
    expect(errs(withConsent({ publicationScope: "anonymised-summary" }))).toEqual([]);
  });
});

describe("validateEntry: privacy and shape", () => {
  const withText = (text: string) => ({ ...entry("livelihoods", 1), text });
  it.each([
    ["an email address", "Write to someone@example.org about the road works near us."],
    ["a phone number", "You can call 98765 43210 to hear how the market changed."],
    ["a phone number", "Reach us on +91 79 2658 1234 about the old bus stop."],
    ["a precise coordinate", "The old well was at 23.00123, 72.50456 near the road."],
    ["a precise coordinate", "Our house was at latitude 23 and the lake changed."],
    ["a personal name", "My name is Ramesh and I remember the old road."],
    ["a titled personal name", "Mrs Patel used to sell vegetables at the corner."],
    ["a house or flat address", "We lived in flat no 12 before the flyover came."],
    ["a social handle", "Follow @someone_local for more on the tank changes."],
  ])("rejects %s in text", (rule, text) => { expect(errs(withText(text)).join()).toContain(rule); expect(findIdentifier(text)).toBe(rule); });
  it("does not echo the offending text in the error message", () => expect(errs(withText("Write to someone@example.org about the road works.")).join()).not.toContain("someone@example"));
  it("does not mistake years, ranges or place names for identifiers", () => expect(findIdentifier("Between 1998-2005 and 2010 the Sarkhej Roza road and the lake changed a lot.")).toBeNull());
  it("rejects private fields and unknown fields (names, contacts, coordinates)", () => {
    expect(errs({ ...entry("livelihoods", 1), participantName: "x" }).join()).toMatch(/restricted private field/);
    expect(errs({ ...entry("livelihoods", 1), phone: "1" }).join()).toMatch(/restricted private field/);
    expect(errs({ ...entry("livelihoods", 1), lat: 23.1, lng: 72.5 }).join()).toMatch(/unexpected field "lat"/);
    const e = entry("livelihoods", 1); expect(errs({ ...e, provenance: { ...e.provenance, latitude: 23.1 } }).join()).toMatch(/unexpected field "latitude"/);
  });
  it("locality must be ward or neighbourhood level, not an address or coordinate", () => {
    const e = entry("livelihoods", 1);
    for (const locality of ["Plot 12 Main Road", "23.0012, 72.5001", "", "a@b.co"]) expect(errs({ ...e, provenance: { ...e.provenance, locality } }).length).toBeGreaterThan(0);
  });
  it("rejects unknown themes and over-long or too short text", () => {
    expect(errs({ ...entry("livelihoods", 1), theme: "gossip" }).join()).toMatch(/unknown theme/);
    expect(errs(withText("x".repeat(MAX_TEXT + 1))).join()).toMatch(/too long/);
    expect(errs(withText("short")).join()).toMatch(/too short/);
  });
  it("rejects bad years and invalid periods", () => {
    expect(errs({ ...entry("livelihoods", 1), period: { kind: "before-after", beforeYear: 2020, afterYear: 2005 } }).join()).toMatch(/beforeYear < afterYear/);
    expect(errs({ ...entry("livelihoods", 1), period: { kind: "period", from: 1800, to: 1990 } }).join()).toMatch(/1900/);
    expect(errs({ ...entry("livelihoods", 1), period: { kind: "period", from: 2010, to: 2000 } }).join()).toMatch(/from <= to/);
  });
});

describe("validateEntry: missing values are explicit, never defaulted", () => {
  it("accepts an explicit missing reason for period, perspective and locality", () => {
    const e = entry("livelihoods", 1);
    expect(errs({ ...e, period: { missing: "unsure" }, perspective: { missing: "refused" }, provenance: { ...e.provenance, locality: { missing: "not_asked" } } })).toEqual([]);
  });
  it("rejects an absent value and an invalid reason rather than defaulting", () => {
    const rest: Record<string, unknown> = { ...entry("livelihoods", 1) }; delete rest["period"]; delete rest["perspective"];
    expect(errs(rest).join()).toMatch(/period is missing.*perspective is missing/);
    expect(errs({ ...entry("livelihoods", 1), period: { missing: "whatever" } }).join()).toMatch(/period must be|period.kind/);
  });
  it("carries the missing reason through to the published file unchanged", () => {
    const list = group("livelihoods").map((e, i) => (i === 0 ? { ...e, period: { missing: "unsure" as const }, perspective: { missing: "skipped" as const } } : e));
    const d = importCommunity(list, { asOf: AS_OF }).doc.entries[0]!;
    expect(d.period).toEqual({ missing: "unsure" }); expect(d.perspective).toEqual({ missing: "skipped" });
  });
});

describe("importCommunity", () => {
  it("publishes only the allowlisted public fields: no consent id, approver or exact date", () => {
    const rep = importCommunity(publishable(), { asOf: AS_OF });
    expect(rep.doc.status).toBe("published"); expect(rep.doc.entries).toHaveLength(15);
    const s = JSON.stringify(rep.doc);
    expect(s).not.toMatch(/consentId|SYN-CONSENT|approverRole|consentedOn|withdrawn|2026-03-01/);
    expect(parsePublished(rep.doc)).not.toBeNull();
  });
  it("drops rejected entries and names them without their text", () => {
    const rep = importCommunity([...publishable(), withConsent({ withdrawn: true }), entry("heritage-connection", 9, { text: "Call me on 9876543210 please about the Roza." })], { asOf: AS_OF });
    expect(rep.rejected).toHaveLength(2); expect(rep.doc.entries).toHaveLength(15);
    expect(JSON.stringify(rep.rejected)).not.toContain("9876543210");
  });
  it("rejects duplicate ids and duplicate text", () => {
    const [a] = group("livelihoods", 1);
    const rep = importCommunity([...group("livelihoods"), a!, { ...a!, id: "other-id" }], { asOf: AS_OF });
    expect(rep.rejected.map((r) => r.errors.join())).toEqual([expect.stringMatching(/duplicate id/), expect.stringMatching(/duplicate text/)]);
  });
  it("suppresses a theme with fewer than the minimum cell size and reports only a total", () => {
    const rep = importCommunity([...group("livelihoods", MIN_CELL_SIZE - 1), ...group("transport-access")], { asOf: AS_OF });
    expect(rep.suppressed).toBe(MIN_CELL_SIZE - 1);
    expect(rep.doc.entries.every((e) => e.theme === "transport-access")).toBe(true);
  });
  it("counts distinct consents: one person cannot fill a cell", () => {
    const one = group("livelihoods").map((e) => ({ ...e, consent: { ...e.consent, consentId: "SYN-ONE-PERSON" } }));
    const rep = importCommunity(one, { asOf: AS_OF });
    expect(rep.doc.entries).toEqual([]); expect(rep.doc.status).toBe("no-approved-material"); expect(rep.suppressed).toBe(5);
  });
  it("suppresses a small locality group even when the theme is large, then re-checks the themes", () => {
    const other = (e: CommunityEntryInput): CommunityEntryInput => ({ ...e, provenance: { ...e.provenance, locality: "Other Synthetic Ward" } });
    const list = [...group("transport-access"), ...group("livelihoods", 2).map(other)];
    const rep = importCommunity(list, { asOf: AS_OF });
    expect(rep.doc.entries).toHaveLength(5); expect(rep.suppressed).toBe(2);
    // one "livelihoods" entry sits alone in a tiny locality: it goes, which drops livelihoods to 4 and suppresses the rest of that theme too
    const z = group("livelihoods");
    const cascade = importCommunity([...group("transport-access"), ...z.slice(0, 4), { ...z[4]!, provenance: { ...z[4]!.provenance, locality: "Tiny Synthetic Ward" } }], { asOf: AS_OF });
    expect(cascade.doc.entries.every((e) => e.theme === "transport-access")).toBe(true);
    expect(cascade.doc.entries).toHaveLength(5); expect(cascade.suppressed).toBe(5);
  });
  it("treats an unrecorded locality as one group subject to the same minimum", () => {
    const miss = (e: CommunityEntryInput): CommunityEntryInput => ({ ...e, provenance: { ...e.provenance, locality: { missing: "not_asked" } } });
    expect(importCommunity(group("livelihoods").map(miss), { asOf: AS_OF }).doc.entries).toHaveLength(5);
    expect(importCommunity(group("livelihoods", 4).map(miss), { asOf: AS_OF }).doc.entries).toHaveLength(0);
  });
  it("rejects a file that is not an entry list", () => expect(importCommunity({ nope: 1 }, { asOf: AS_OF }).rejected[0]!.errors[0]).toMatch(/array of entries/));
  it("an empty or fully withdrawn file produces the empty no-approved-material document", () => {
    expect(importCommunity([], { asOf: AS_OF }).doc).toMatchObject({ status: "no-approved-material", entries: [] });
  });
});

describe("parsePublished and fetchCommunity (defence in depth for what ships)", () => {
  const good = () => importCommunity(publishable(), { asOf: AS_OF }).doc;
  it("rejects a hand-edited document: identifier, extra field, withheld scope, small cell, non-empty 'no material'", () => {
    const g = good();
    const edit = (f: (d: { entries: Record<string, unknown>[]; [k: string]: unknown }) => void) => { const d = JSON.parse(JSON.stringify(g)); f(d); return parsePublished(d); };
    expect(edit((d) => { d.entries[0]!.text = "Email someone@example.org about the road changes."; })).toBeNull();
    expect(edit((d) => { d.entries[0]!.consentId = "x"; })).toBeNull();
    expect(edit((d) => { d.entries[0]!.scope = "withheld"; })).toBeNull();
    expect(edit((d) => { d.entries = d.entries.slice(1); })).toBeNull();
    expect(edit((d) => { d.status = "no-approved-material"; })).toBeNull();
    expect(edit((d) => { d.minCellSize = 2; })).toBeNull();
  });
  it("fetchCommunity maps 404 to missing, bad JSON shapes to error, and good documents to ok", async () => {
    const f = (status: number, body: unknown) => (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
    expect((await fetchCommunity(undefined, f(404, {}))).status).toBe("missing");
    expect((await fetchCommunity(undefined, f(500, {}))).status).toBe("error");
    expect((await fetchCommunity(undefined, f(200, { version: 1 }))).status).toBe("error");
    expect((await fetchCommunity(undefined, f(200, good()))).status).toBe("ok");
  });
});

describe("the shipped data/content/community.json", () => {
  const shipped = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/content/community.json"), "utf8"));
  it("is valid, empty and says no approved material exists", () => {
    expect(parsePublished(shipped)).not.toBeNull();
    expect(shipped).toEqual({ version: 1, status: "no-approved-material", updated: null, minCellSize: 5, entries: [] });
  });
  it("contains no synthetic fixture text and no identifier", () => {
    const s = JSON.stringify(shipped);
    expect(s).not.toMatch(/Synthetic|syn-/i); expect(findIdentifier(s)).toBeNull();
  });
  it("the theme list in the schema matches the documented themes", () => expect([...COMMUNITY_THEMES]).toHaveLength(8));
});
