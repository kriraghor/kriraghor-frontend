import { describe, expect, it } from "vitest";
import { dhakaDay, diffRows, toApiFilters } from "../admin/audit";

describe("toApiFilters", () => {
  it("turns Dhaka days into an inclusive ISO range and drops empty fields", () => {
    expect(toApiFilters({ from: "2026-10-01", to: "2026-10-15", action: " setting.changed ", module: "", stepUp: true })).toEqual({
      from: "2026-10-01T00:00:00.000+06:00",
      to: "2026-10-15T23:59:59.999+06:00",
      action: "setting.changed",
      stepUp: "true",
    });
    expect(toApiFilters({ stepUp: false })).toEqual({});
  });
});

describe("dhakaDay", () => {
  it("uses the Dhaka calendar day", () => {
    // 20:30 UTC on 14 Oct is 02:30 on 15 Oct in Dhaka.
    expect(dhakaDay(new Date("2026-10-14T20:30:00Z"))).toBe("2026-10-15");
    expect(dhakaDay(new Date("2026-10-14T20:30:00Z"), 7)).toBe("2026-10-08");
  });
});

describe("diffRows", () => {
  it("lists changed fields first", () => {
    expect(diffRows({ value: 5, version: 1, key: "fees.x" }, { value: 6, version: 2, key: "fees.x" })).toEqual([
      { field: "value", before: "5", after: "6", changed: true },
      { field: "version", before: "1", after: "2", changed: true },
      { field: "key", before: "fees.x", after: "fees.x", changed: false },
    ]);
  });

  it("handles missing sides, nested values and scalars", () => {
    expect(diffRows(null, { status: "active", meta: { a: 1 } })).toEqual([
      { field: "status", before: "", after: "active", changed: true },
      { field: "meta", before: "", after: '{"a":1}', changed: true },
    ]);
    expect(diffRows(5, 6)).toEqual([{ field: "value", before: "5", after: "6", changed: true }]);
    expect(diffRows({ a: null }, {})).toEqual([{ field: "a", before: "null", after: "", changed: true }]);
  });
});
