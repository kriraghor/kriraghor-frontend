import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { takaToPoisha } from "../admin/trust";

describe("dispute desk helpers (M17)", () => {
  it("reads a custom refund in taka as poisha", () => {
    expect(takaToPoisha("250")).toBe(25000);
    expect(takaToPoisha("237.5")).toBe(23750);
    expect(takaToPoisha("1,237.50")).toBe(123750);
    expect(takaToPoisha(" 0 ")).toBe(0);
    expect(takaToPoisha("12.345")).toBeNull();
    expect(takaToPoisha("-5")).toBeNull();
    expect(takaToPoisha("abc")).toBeNull();
  });

  it("keeps the English and Bangla desk texts in step", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    for (const ns of ["disputesDesk", "reportsDesk", "reviewsDesk", "vendorTrust"] as const) expect(keys(bn[ns]).sort()).toEqual(keys(en[ns]).sort());
  });
});
