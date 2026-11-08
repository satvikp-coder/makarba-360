import { describe, expect, it } from "vitest";
import { archiveCategory, canAssign, labelFor, publicCategories, validateTaxonomy, type Category } from "./categories.js";

const heritage: Category = { id: "heritage", labels: { en: "Heritage", gu: "વારસો" }, icon: "landmark", archived: false, sortOrder: 2 };
const water: Category = { id: "water", labels: { en: "Water" }, icon: "droplet", archived: false, sortOrder: 1 };
const market: Category = { id: "market", labels: { en: "Market" }, icon: "store", archived: false };
const base: Category[] = [heritage, water, market];
const codes = (l: Category[]) => validateTaxonomy(l).map((i) => i.code);

describe("taxonomy validation", () => {
  it("accepts a clean synthetic taxonomy", () => expect(validateTaxonomy(base)).toEqual([]));
  it("rejects bad, uppercase, too-short and duplicate codes", () => {
    expect(codes([{ ...heritage, id: "Heritage" }])).toContain("bad_code");
    expect(codes([{ ...heritage, id: "h" }])).toContain("bad_code");
    expect(codes([heritage, { ...water, id: "heritage" }])).toContain("duplicate_code");
  });
  it("requires a non-blank English fallback and non-blank labels in other locales", () => {
    expect(codes([{ ...heritage, labels: { gu: "x" } }])).toContain("missing_fallback_label");
    expect(codes([{ ...heritage, labels: { en: "  " } }])).toContain("missing_fallback_label");
    expect(codes([{ ...heritage, labels: { en: "H", gu: "" } }])).toContain("empty_label");
    expect(codes([{ ...heritage, labels: { en: "H", "NOT A LOCALE": "x" } }])).toContain("bad_locale");
  });
  it("requires distinct icons among active categories but lets an archived one free its icon", () => {
    expect(codes([heritage, { ...water, icon: "landmark" }])).toContain("duplicate_icon");
    expect(codes([heritage, { ...water, icon: "landmark", archived: true }])).not.toContain("duplicate_icon");
  });
  it("rejects malformed icon and colour tokens", () => {
    expect(codes([{ ...heritage, icon: "<script>" }])).toContain("bad_icon");
    expect(codes([{ ...heritage, colorToken: "#fff" }])).toContain("bad_color");
  });
});

describe("archive keeps history", () => {
  it("archiving keeps the row, blocks new assignment and permits a replacement", () => {
    const next = archiveCategory(base, "market", "water");
    expect(next.find((c) => c.id === "market")).toMatchObject({ archived: true, replacedBy: "water" });
    expect(canAssign(next, "market")).toBe(false);
    expect(canAssign(next, "water")).toBe(true);
    expect(next).toHaveLength(base.length);
  });
  it("refuses an unknown category and a self, unknown or archived replacement", () => {
    expect(() => archiveCategory(base, "nope")).toThrow(/unknown/);
    expect(() => archiveCategory(base, "market", "market")).toThrow();
    expect(() => archiveCategory(base, "market", "ghost")).toThrow(/bad_replacement/);
    const once = archiveCategory(base, "water");
    expect(() => archiveCategory(once, "market", "water")).toThrow(/archived_replacement/);
  });
});

describe("display and public read model", () => {
  it("falls back to English then to the code, never blank", () => {
    expect(labelFor(heritage, "gu")).toBe("વારસો");
    expect(labelFor(water, "gu-IN")).toBe("Water");
    expect(labelFor({ id: "x_code", labels: {} }, "en")).toBe("x_code");
  });
  it("orders active categories and hides archived ones unless a published place still uses them", () => {
    const l = archiveCategory(base, "market");
    expect(publicCategories(l, new Set()).map((c) => c.id)).toEqual(["water", "heritage"]);
    expect(publicCategories(l, new Set(["market"])).map((c) => c.id)).toContain("market");
  });
});
