import { describe, expect, it } from "vitest";
import { display, effectiveAtIso, parseInput, poishaToTaka, rangeHint, sameValue, takaToPoisha, toInput, type Setting } from "../admin/settings";

const setting = (over: Partial<Setting>): Setting => ({
  key: "x.y",
  category: "fees",
  value: 0,
  valueType: "int",
  unit: null,
  min: null,
  max: null,
  options: null,
  approval: "single",
  isPublic: false,
  label: { en: "X", bn: "এক্স" },
  why: null,
  version: 1,
  updatedBy: null,
  updatedAt: null,
  ...over,
});

describe("parseInput (Fees and rules inline validation)", () => {
  it("percent with bounds and two decimals", () => {
    const fee = setting({ valueType: "decimal", value: 5, unit: "%", min: 0, max: 25 });
    expect(parseInput(fee, "6")).toEqual({ ok: true, value: 6 });
    expect(parseInput(fee, "7.25")).toEqual({ ok: true, value: 7.25 });
    expect(parseInput(fee, "7.255")).toEqual({ ok: false, error: "At most 2 decimal places" });
    expect(parseInput(fee, "26")).toEqual({ ok: false, error: "Between 0 and 25" });
    expect(parseInput(fee, "abc")).toEqual({ ok: false, error: "Enter a number" });
  });

  it("money: people type taka, the API gets poisha", () => {
    const fee = setting({ valueType: "money", value: 8000, min: 0, max: 1000000 });
    expect(parseInput(fee, "80")).toEqual({ ok: true, value: 8000 });
    expect(parseInput(fee, "1,250.50")).toEqual({ ok: true, value: 125050 });
    expect(parseInput(fee, "0.005")).toEqual({ ok: false, error: "At most 2 decimal places (poisha)" });
    expect(parseInput(fee, "-1")).toEqual({ ok: false, error: "Cannot be negative" });
    expect(parseInput(fee, "20000")).toEqual({ ok: false, error: "Between ৳0 and ৳10000" });
    expect(toInput(fee)).toBe("80");
    expect(display(fee, 125050)).toBe("৳1,250.5");
  });

  it("whole numbers, booleans, enums and times", () => {
    expect(parseInput(setting({ valueType: "int", min: 1, max: 60 }), "2.5")).toEqual({ ok: false, error: "Enter a whole number" });
    expect(parseInput(setting({ valueType: "int", min: 1 }), "0")).toEqual({ ok: false, error: "At least 1" });
    expect(parseInput(setting({ valueType: "int", max: 5 }), "6")).toEqual({ ok: false, error: "At most 5" });
    expect(parseInput(setting({ valueType: "bool", value: true }), false)).toEqual({ ok: true, value: false });
    expect(parseInput(setting({ valueType: "bool" }), "yes")).toEqual({ ok: false, error: "Choose on or off" });
    expect(parseInput(setting({ valueType: "enum", options: ["pre", "post"] }), "pre")).toEqual({ ok: true, value: "pre" });
    expect(parseInput(setting({ valueType: "enum", options: ["pre", "post"] }), "x")).toEqual({ ok: false, error: "Pick one of the options" });
    expect(parseInput(setting({ valueType: "time" }), "06:00")).toEqual({ ok: true, value: "06:00" });
    expect(parseInput(setting({ valueType: "time" }), "25:00")).toEqual({ ok: false, error: "Use a time like 06:00" });
  });

  it("lists and maps", () => {
    expect(parseInput(setting({ valueType: "int_list" }), "60, 90,120")).toEqual({ ok: true, value: [60, 90, 120] });
    expect(parseInput(setting({ valueType: "int_list" }), "60, 60")).toEqual({ ok: false, error: "Each number only once" });
    expect(parseInput(setting({ valueType: "int_list" }), "")).toEqual({ ok: false, error: "Enter at least one number" });
    expect(parseInput(setting({ valueType: "string_list" }), "sports_gear, gym_gear")).toEqual({ ok: true, value: ["sports_gear", "gym_gear"] });
    expect(parseInput(setting({ valueType: "string_list" }), "Sports Gear")).toEqual({ ok: false, error: "Lowercase keys like sports_gear, separated by commas" });
    const tiers = setting({ valueType: "json", value: { daily: 1, weekly: 2 } });
    expect(toInput(tiers)).toEqual({ daily: "1", weekly: "2" });
    expect(parseInput(tiers, { daily: "1", weekly: "3" })).toEqual({ ok: true, value: { daily: 1, weekly: 3 } });
    expect(parseInput(tiers, { daily: "", weekly: "3" })).toEqual({ ok: false, error: "daily: enter a number of 0 or more" });
    expect(display(tiers, { daily: 1, weekly: 2 })).toBe("daily 1 · weekly 2");
  });
});

describe("helpers", () => {
  it("money conversion never drifts", () => {
    expect(takaToPoisha(0.1 + 0.2)).toBe(30);
    expect(poishaToTaka(8000)).toBe("80");
    expect(poishaToTaka(8050)).toBe("80.50");
  });

  it("sameValue ignores object key order", () => {
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue(5, 5)).toBe(true);
  });

  it("display and range hints", () => {
    expect(display(setting({ valueType: "decimal", unit: "%" }), 5)).toBe("5%");
    expect(display(setting({ valueType: "int", unit: "min" }), 15)).toBe("15 min");
    expect(display(setting({ valueType: "bool" }), true)).toBe("On");
    expect(rangeHint(setting({ valueType: "decimal", unit: "%", min: 0, max: 20 }))).toBe("0–20 %");
    expect(rangeHint(setting({ valueType: "money", min: 0, max: 100000 }))).toBe("৳0–৳1000");
    expect(rangeHint(setting({ valueType: "int" }))).toBeNull();
  });

  it("effectiveAtIso: empty means now", () => {
    expect(effectiveAtIso("")).toBeUndefined();
    expect(effectiveAtIso("not a date")).toBeUndefined();
    expect(effectiveAtIso("2026-11-01T00:00")).toMatch(/^2026-1[01]-\d\dT/);
  });
});

describe("categories (M24 prompt 1)", () => {
  it("shows the gym subscription settings (gym_saas) right after the gym card, with EN and BN names", async () => {
    const { CATEGORY_ORDER } = await import("../admin/settings");
    expect(CATEGORY_ORDER.indexOf("gym_saas")).toBe(CATEGORY_ORDER.indexOf("gym") + 1);
    const en = (await import("../../../messages/en.json")).default as { categories: Record<string, string> };
    const bn = (await import("../../../messages/bn.json")).default as { categories: Record<string, string> };
    for (const cat of CATEGORY_ORDER) {
      expect(en.categories[cat], cat).toBeTruthy();
      expect(bn.categories[cat], cat).toBeTruthy();
    }
  });
});
