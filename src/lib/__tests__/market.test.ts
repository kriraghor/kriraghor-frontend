import { describe, expect, it } from "vitest";
import { axisChoices, bandOf, filtersFromParams, paramsFromFilters, pickedVariant, type ProductPage } from "../market";

const opt = (value: string) => ({ value, labelEn: value, labelBn: value });
const axis = (key: string, values: string[]) => ({ key, labelEn: key, labelBn: key, kind: "select" as const, options: values.map(opt), unit: null, min: null, max: null, required: true, isVariantAxis: true });
const variant = (id: string, attributes: Record<string, string>, purchasable: boolean) => ({ id, attributes, labelEn: id, labelBn: id, pricePoisha: 650000, stock: { code: purchasable ? "in_stock" : "out_hidden", available: null, days: null }, purchasable, expiryDate: null });

describe("market filters (M12 FR-31)", () => {
  it("round-trips the filters through the URL", () => {
    const f = { category: "football", types: ["football_boots"], priceMin: 200000, priceMax: 800000, q: "predator", sort: "-price" as const };
    expect(filtersFromParams(new URLSearchParams(paramsFromFilters(f).slice(1)))).toEqual({ ...f, areaId: undefined });
    expect(paramsFromFilters({})).toBe("");
    expect(filtersFromParams(new URLSearchParams("sort=weird&min=abc")).sort).toBeUndefined();
  });

  it("finds the price band", () => {
    expect(bandOf({ priceMax: 200000 })).toBe("lt2000");
    expect(bandOf({ priceMin: 200000, priceMax: 800000 })).toBe("2000to8000");
    expect(bandOf({ priceMin: 800000 })).toBe("gt8000");
    expect(bandOf({ priceMin: 100 })).toBeUndefined();
  });
});

describe("variant picker", () => {
  const page = {
    axes: [axis("eu_size", ["42", "43", "44"]), axis("colour", ["black", "white"])],
    variants: [variant("a", { eu_size: "42", colour: "black" }, true), variant("b", { eu_size: "43", colour: "black" }, false), variant("c", { eu_size: "43", colour: "white" }, true)],
  } as unknown as Pick<ProductPage, "axes" | "variants">;

  it("shows only options that exist and disables sold-out combinations", () => {
    const sizes = axisChoices(page, { colour: "black" })[0];
    expect(sizes.options.map((o) => [o.option.value, o.available])).toEqual([
      ["42", true],
      ["43", false],
    ]);
    expect(axisChoices(page, {})[0].options.map((o) => o.available)).toEqual([true, true]);
  });

  it("picks the variant once every axis is chosen", () => {
    expect(pickedVariant(page, { eu_size: "43", colour: "white" })?.id).toBe("c");
    expect(pickedVariant(page, { eu_size: "43" })).toBeNull();
    const standard = { axes: [], variants: [variant("s", {}, true)] } as unknown as Pick<ProductPage, "axes" | "variants">;
    expect(pickedVariant(standard, {})?.id).toBe("s");
  });
});
