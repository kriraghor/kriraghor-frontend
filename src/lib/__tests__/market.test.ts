import { describe, expect, it } from "vitest";
import { specsFrom, toPoisha, typesForShop, variantLabel, type Category, type ItemField } from "../vendor/market";
import { parseOptions, productDiffLines } from "../admin/market";

const field = (key: string, extra: Partial<ItemField> = {}): ItemField => ({ key, labelEn: key, labelBn: key, kind: "select", options: [], unit: null, min: null, max: null, required: false, isVariantAxis: false, ...extra });

describe("shop desk helpers (M12)", () => {
  it("offers only the item types a shop type may sell", () => {
    const cats = [
      { key: "football", shopTypes: ["sports_gear"], types: [{ id: "boots" }] },
      { key: "supplements", shopTypes: ["supplements"], types: [{ id: "whey" }] },
    ] as unknown as Category[];
    expect(typesForShop(cats, "sports_gear").map((x) => x.type.id)).toEqual(["boots"]);
    expect(typesForShop(cats, "supplements").map((x) => x.type.id)).toEqual(["whey"]);
  });

  it("turns form values into specs (numbers as numbers, axes and blanks left out)", () => {
    const fields = [field("stud_type"), field("weight_g", { kind: "number" }), field("eu_size", { isVariantAxis: true }), field("material", { kind: "text" })];
    expect(specsFrom(fields, { stud_type: "tf", weight_g: "1200", eu_size: "43", material: " " })).toEqual({ stud_type: "tf", weight_g: 1200 });
  });

  it("labels variants", () => {
    const fields = [field("eu_size", { isVariantAxis: true, options: [{ value: "43", labelEn: "EU 43", labelBn: "ইইউ ৪৩" }] })];
    expect(variantLabel(fields, { eu_size: "43" }, "en", "Standard")).toBe("EU 43");
    expect(variantLabel(fields, { eu_size: "43" }, "bn", "Standard")).toBe("ইইউ ৪৩");
    expect(variantLabel(fields, { eu_size: "44" }, "en", "Standard")).toBe("44");
    expect(variantLabel(fields, {}, "en", "Standard")).toBe("Standard");
  });

  it("reads taka into poisha", () => {
    expect(toPoisha("6500")).toBe(650000);
    expect(toPoisha("6500.5")).toBe(650050);
    expect(toPoisha("abc")).toBeNull();
  });
});

describe("admin market helpers", () => {
  const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? JSON.stringify(v) : ""}`;
  it("describes a product diff for the reviewer", () => {
    expect(productDiffLines(undefined, t, String)).toEqual(["diff.first"]);
    expect(productDiffLines({ first: false, fields: [] }, t, String)).toEqual(["diff.none"]);
    const lines = productDiffLines({ first: false, fields: [{ field: "title", from: "A", to: "B" }], prices: [{ variantId: "v", from: 1, to: 2 }], photos: { added: 1, removed: 2 } }, t, String);
    expect(lines).toHaveLength(4);
  });

  it("parses pick-list options", () => {
    expect(parseOptions("S:Small:ছোট\nM\n\n")).toEqual([
      { value: "S", labelEn: "Small", labelBn: "ছোট" },
      { value: "M", labelEn: "M", labelBn: "M" },
    ]);
  });
});
