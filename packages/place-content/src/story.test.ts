import { describe, expect, it } from "vitest";
import { blockProblems, removeBlock, revokeMemory, storyBlockers, toPublicStory, type FactBlock, type MemoryBlock, type OfficialBlock, type Story } from "./story.js";

const fact = (o: Partial<FactBlock> = {}): FactBlock => ({ kind: "fact", id: "f1", text: "Synthetic checked statement.", sourceId: "s1", sourceVerified: true, verifiedBy: "rita", enteredBy: "eve", ...o });
const memory = (o: Partial<MemoryBlock> = {}): MemoryBlock => ({ kind: "memory", id: "m1", quote: "Synthetic remembered words.", period: "around the nineties, as they said", consentPublish: "granted", quoteConsentRecorded: true, attributionPermitted: "anonymous_role", roleLabel: "a long-time shopkeeper", displayName: null, containsIdentifyingDetail: false, identifyingDetailReviewed: false, ...o });
const official = (o: Partial<OfficialBlock> = {}): OfficialBlock => ({ kind: "official", id: "o1", text: "Synthetic official wording.", body: "Synthetic Ward Office", verificationEvidence: "letter ref SYN-1 on file", scope: "statement about the lake works", statementDate: "2026-03-01", ...o });
const story = (blocks = [fact(), memory(), official()], o: Partial<Story> = {}): Story => ({ id: "st1", locationId: "00000000-0000-4000-8000-000000000001", revision: 2, title: "Synthetic lake story", blocks, authorId: "eve", reviewedBy: "rita", state: "reviewed", ...o });
const ctx = { latestRevision: 2 };
const reasons = (s: Story) => storyBlockers(s, ctx).map((p) => `${p.blockId}: ${p.reason}`);

describe("a reviewed story with all three kinds is publishable and stays labelled", () => {
  it("has no blockers", () => { expect(reasons(story())).toEqual([]); });
  it("the public form labels each block, keeps the kinds separate and carries no reviewer, author or consent data", () => {
    const p = toPublicStory(story([fact(), memory(), official()], { state: "published" }), ctx)!;
    expect(p.blocks.map((b) => b.label)).toEqual(["Verified fact", "What a person remembers", "Official statement"]);
    expect(p.blocks[1]).toMatchObject({ quote: "Synthetic remembered words.", attribution: "a long-time shopkeeper" });
    expect(JSON.stringify(p)).not.toMatch(/rita|eve|consent|reviewedBy|authorId|SYN-1|sourceId/);
  });
  it("only a published story has a public form", () => {
    for (const state of ["draft", "reviewed", "withdrawn"] as const) expect(toPublicStory(story(undefined, { state }), ctx), state).toBeNull();
  });
});

describe("facts", () => {
  it("need a verified source and an independent reviewer", () => {
    expect(blockProblems(fact({ sourceId: null }))).toContain("fact has no verified source");
    expect(blockProblems(fact({ sourceVerified: false }))).toContain("fact has no verified source");
    expect(blockProblems(fact({ verifiedBy: null }))).toContain("fact has no reviewer");
    expect(blockProblems(fact({ verifiedBy: "eve" }))).toContain("fact was verified by the person who entered it");
  });
});

describe("memories: permission and attribution", () => {
  it("need granted publication permission and recorded quote consent", () => {
    expect(blockProblems(memory({ consentPublish: "not_requested" }))).toContain('permission to publish is "not_requested"');
    expect(blockProblems(memory({ consentPublish: "withdrawn" }))).toContain('permission to publish is "withdrawn"');
    expect(blockProblems(memory({ quoteConsentRecorded: false }))).toContain("quote consent not recorded");
  });
  it("attribution appears only as permitted: none shows nothing, role shows the role, a name needs a recorded name", () => {
    const pub = (m: MemoryBlock) => (toPublicStory(story([m], { state: "published" }), ctx)!.blocks[0] as { attribution: string | null }).attribution;
    expect(pub(memory({ attributionPermitted: "none", roleLabel: "a shopkeeper", displayName: "Synthetic Name" }))).toBeNull();
    expect(pub(memory({ attributionPermitted: "anonymous_role", displayName: "Synthetic Name" }))).toBe("a long-time shopkeeper");
    expect(pub(memory({ attributionPermitted: "named", displayName: "  Synthetic Name " }))).toBe("Synthetic Name");
    expect(blockProblems(memory({ attributionPermitted: "named", displayName: null }))).toContain("named attribution permitted but no name recorded");
    expect(blockProblems(memory({ attributionPermitted: "anonymous_role", roleLabel: " " }))).toContain("anonymous attribution needs a role label");
  });
  it("identifying details must have been reviewed", () => {
    expect(blockProblems(memory({ containsIdentifyingDetail: true }))).toContain("identifying details have not been reviewed");
    expect(blockProblems(memory({ containsIdentifyingDetail: true, identifyingDetailReviewed: true }))).toEqual([]);
  });
});

describe("official statements: an unverified official claim stays unpublished", () => {
  it("evidence, scope, body and date are all required", () => {
    expect(blockProblems(official({ verificationEvidence: null }))).toContain("official claim is unverified: evidence and scope are required");
    expect(blockProblems(official({ scope: " " }))).toContain("official claim is unverified: evidence and scope are required");
    expect(blockProblems(official({ body: null }))).toContain("official statement names no body");
    expect(blockProblems(official({ statementDate: null }))).toContain("official statement has no date");
  });
  it("one unverified official block keeps the whole story unpublished and toPublicStory returns nothing", () => {
    const s = story([fact(), official({ verificationEvidence: null })]);
    expect(reasons(s)).toEqual(["o1: official claim is unverified: evidence and scope are required"]);
    expect(toPublicStory({ ...s, state: "published" }, ctx)).toBeNull();
  });
});

describe("a revoked quote keeps the story unpublished", () => {
  it("revoking a block in a published story withdraws the story at once, with the reason visible to editors", () => {
    const pub = story(undefined, { state: "published" });
    const revoked = revokeMemory(pub, "m1");
    expect(revoked.state).toBe("withdrawn");
    expect(toPublicStory(revoked, ctx)).toBeNull();
    expect(reasons({ ...revoked, state: "reviewed" })).toContain('m1: permission to publish is "withdrawn"');
  });
  it("removing the block creates a new draft revision that must be reviewed again before it can be published", () => {
    const revoked = revokeMemory(story(undefined, { state: "published" }), "m1");
    const fixed = removeBlock(revoked, "m1");
    expect(fixed).toMatchObject({ revision: 3, state: "draft", reviewedBy: null });
    expect(fixed.blocks.map((b) => b.id)).toEqual(["f1", "o1"]);
    expect(toPublicStory(fixed, { latestRevision: 3 })).toBeNull();
    expect(reasons({ ...fixed })).toEqual(expect.arrayContaining(["-: story state is \"draft\"; only \"reviewed\" stories can be published", "-: story has no reviewer"]));
  });
  it("revoking an unknown block changes nothing", () => { expect(revokeMemory(story(), "nope")).toEqual(story()); });
});

describe("story-level rules", () => {
  it("needs the latest revision, a reviewer other than the author, content and unique block ids", () => {
    expect(reasons(story(undefined, { revision: 1 }))).toContain("-: stale revision 1; latest is 2");
    expect(reasons(story(undefined, { reviewedBy: "eve" }))).toContain("-: story reviewer must differ from its author");
    expect(reasons(story(undefined, { reviewedBy: null }))).toContain("-: story has no reviewer");
    expect(reasons(story([]))).toContain("-: story has no content");
    expect(reasons(story([fact(), fact()]))).toContain("f1: duplicate block id");
  });
  it("a stale published story is no longer shown", () => {
    expect(toPublicStory(story(undefined, { state: "published" }), { latestRevision: 3 })).toBeNull();
  });
});
