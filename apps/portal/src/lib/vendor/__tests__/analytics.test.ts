import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import bn from "../../../../messages/bn.json";
import { analyticsHref, businessOptions, businessQuery, dayBars, hourBars, lineSeries, pickBusiness } from "../analytics";

describe("businessOptions, the analytics business switcher (Round B2)", () => {
  it("venue, shop and gym for active roles in sidebar order", () => {
    const got = businessOptions(["shop_owner", "ground_owner"]);
    expect(got).toEqual([
      { key: "venue", role: "ground_owner" },
      { key: "shop", role: "shop_owner" },
    ]);
  });

  it("nothing for someone with no business", () => {
    expect(businessOptions([])).toEqual([]);
  });
});

describe("pickBusiness and the URL", () => {
  const options = businessOptions(["ground_owner", "shop_owner", "gym_owner"]);

  it("follows ?business=", () => {
    expect(pickBusiness(options, { business: "gym" }, "all")?.key).toBe("gym");
  });

  it("a business not held falls back to the panel's business, then the first", () => {
    const venueOnly = businessOptions(["ground_owner"]);
    expect(pickBusiness(venueOnly, { business: "shop" }, "all")?.key).toBe("venue");
    expect(pickBusiness(options, { business: "organiser" }, "shop_owner")?.key).toBe("shop");
    expect(pickBusiness(options, { business: "" }, "gym_owner")?.key).toBe("gym");
    expect(pickBusiness(options, { business: "" }, "all")?.key).toBe("venue");
    expect(pickBusiness([], { business: "shop" }, "all")).toBeNull();
  });

  it("writes the URL parameter back", () => {
    expect(businessQuery({ role: "shop_owner" })).toEqual({ business: "shop" });
    expect(analyticsHref("gym_owner")).toBe("/go/gym/manage/reports"); // M24 prompt 2: the gym reports
    expect(analyticsHref("ground_owner")).toBe("/vendor/analytics?business=venue");
  });
});

describe("chart series", () => {
  const points = [
    { key: "2026-09-28", from: "2026-09-28", value: 1000, lastYear: 800 },
    { key: "2026-10-05", from: "2026-10-05", value: 1500, lastYear: 0 },
  ];

  it("a line with last year as the second series, left out when last year is empty (FR-05)", () => {
    expect(lineSeries({ points, lastYearShown: true })).toEqual({ points: [{ key: "2026-09-28", value: 1000 }, { key: "2026-10-05", value: 1500 }], compare: [800, 0] });
    expect(lineSeries({ points, lastYearShown: false }).compare).toBeNull();
    expect(lineSeries({ points: [], lastYearShown: false })).toEqual({ points: [], compare: null });
  });

  it("busiest hours as all 24 hours of the day, missing hours at 0, a tick every six hours", () => {
    const bars = hourBars([
      { hour: 18, value: 12 },
      { hour: 6, value: 4 },
    ]);
    expect(bars).toHaveLength(24);
    expect(bars[18]).toEqual({ label: "6 pm", value: 12, tick: "6 pm" });
    expect(bars[6].value).toBe(4);
    expect(bars[7]).toEqual({ label: "7 am", value: 0, tick: "" });
    expect(bars.filter((b) => b.tick).map((b) => b.tick)).toEqual(["12 am", "6 am", "12 pm", "6 pm"]);
    expect(hourBars([], "bn")[18].label).not.toBe("6 pm");
  });

  it("days: a label under each of up to ten bars; a month's days get a tick every fifth bar and no figures", () => {
    const week = Array.from({ length: 7 }, (_, i) => ({ day: `2026-10-${String(12 + i).padStart(2, "0")}`, value: i }));
    const w = dayBars(week);
    expect(w.values).toBe(true);
    expect(w.bars[0]).toEqual({ label: "Mon 12", value: 0 });
    const month = Array.from({ length: 31 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, value: 1 }));
    const m = dayBars(month);
    expect(m.values).toBe(false);
    expect(m.bars.filter((b) => b.tick).map((b) => b.tick)).toEqual(["1", "6", "11", "16", "21", "26", "31"]);
    expect(new Set(m.bars.map((b) => b.label)).size).toBe(31);
  });
});

describe("Round B2 words exist in both languages", () => {
  const at = (tree: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), tree);
  const keys = [
    "dashboard.business.ground_owner",
    "dashboard.business.shop_owner",
    "dashboard.business.gym_owner",
    "dashboard.passKind.day",
    "dashboard.passKind.month",
    "dashboard.passKind.quarter",
    "dashboard.comingLater.conversion",
    "dashboard.comingLater.shopperFunnel",
    "dashboard.csv.limit",
    "dashboard.csv.tooLarge",
  ];
  it.each(keys)("%s", (k) => {
    expect(typeof at(en, k)).toBe("string");
    expect(typeof at(bn, k)).toBe("string");
  });
});
