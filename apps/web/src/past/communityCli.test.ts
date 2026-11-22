import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "./communityCli.js";
import { parsePublished } from "./communityModel.js";
import { entry, publishable } from "./__fixtures__/communitySynthetic.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function setup(entries: unknown) {
  const d = mkdtempSync(join(tmpdir(), "community-")); dirs.push(d);
  const input = join(d, "in.json"), out = join(d, "out.json");
  writeFileSync(input, JSON.stringify({ entries })); return { input, out };
}
const go = (args: string[]) => { const lines: string[] = []; const code = run(args, (s) => lines.push(s), "2026-11-22"); return { code, text: lines.join("\n") }; };

describe("community:check CLI", () => {
  it("writes only the publishable subset", () => {
    const { input, out } = setup(publishable());
    const r = go([input, "--out", out]);
    expect(r.code).toBe(0); expect(r.text).toMatch(/15 publishable/);
    expect(parsePublished(JSON.parse(readFileSync(out, "utf8")))?.entries).toHaveLength(15);
  });
  it("refuses to write when entries are rejected, unless --drop-rejected", () => {
    const bad = entry("livelihoods", 1, { consent: { ...entry("livelihoods", 1).consent, withdrawn: true } });
    const { input, out } = setup([...publishable(), bad]);
    const r = go([input, "--out", out]);
    expect(r.code).toBe(1); expect(r.text).toMatch(/REJECTED entry 15.*withdrawn/); expect(r.text).toMatch(/Nothing written/);
    expect(() => readFileSync(out)).toThrow();
    expect(go([input, "--out", out, "--drop-rejected"]).code).toBe(0);
    expect(parsePublished(JSON.parse(readFileSync(out, "utf8")))?.entries).toHaveLength(15);
  });
  it("--dry-run validates without writing; usage and unreadable files exit 2", () => {
    const { input, out } = setup(publishable());
    expect(go([input, "--out", out, "--dry-run"]).code).toBe(0); expect(() => readFileSync(out)).toThrow();
    expect(go([]).code).toBe(2); expect(go([join(tmpdir(), "does-not-exist.json")]).code).toBe(2);
  });
  it("an all-withdrawn file rewrites the empty no-approved-material document", () => {
    const { input, out } = setup([]);
    expect(go([input, "--out", out]).code).toBe(0);
    expect(JSON.parse(readFileSync(out, "utf8"))).toMatchObject({ status: "no-approved-material", entries: [] });
  });
});
