import { describe, expect, it } from "vitest";
import { compact, compactTaka, count, digits, linear, nearestIndex, niceStep, niceTicks, share, tickEvery, tickShown } from "../charts/scale";
import { deltaTone, pctChange, ptsChange } from "../charts/delta";
import { lastOfMonth, periodFromParams, periodParams, presetOf, presetPeriod, shiftMonth } from "../charts/range";

describe("chart scales (dashboards)", () => {
  it("picks 1, 2, 2.5, 5 or 10 steps", () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(10, 4)).toBe(2.5);
    expect(niceStep(4, 4)).toBe(1);
    expect(niceStep(17, 4)).toBe(5);
    expect(niceStep(70, 4)).toBe(20);
    expect(niceStep(0, 4)).toBe(1);
    expect(niceStep(10, 0)).toBe(1);
  });

  it("makes ticks from zero to a clean top", () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(0, { integer: true })).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(3, { integer: true })).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(10, { min: -10 })).toEqual([-10, -5, 0, 5, 10]);
    expect(niceTicks(1_234_567)).toEqual([0, 500_000, 1_000_000, 1_500_000]);
  });

  it("scales linearly, a flat domain to the middle", () => {
    const y = linear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(linear([5, 5], [0, 10])(5)).toBe(5);
  });

  it("finds the nearest point and clamps it", () => {
    expect(nearestIndex(0, 5, 10, 20)).toBe(0);
    expect(nearestIndex(41, 5, 10, 20)).toBe(2);
    expect(nearestIndex(999, 5, 10, 20)).toBe(4);
    expect(nearestIndex(50, 1, 10, 20)).toBe(0);
    expect(nearestIndex(50, 5, 10, 0)).toBe(0);
  });

  it("thins axis labels and always prints the last", () => {
    expect(tickEvery(30, 10)).toBe(3);
    expect(tickEvery(5, 10)).toBe(1);
    expect(tickEvery(0, 10)).toBe(1);
    expect(tickEvery(10, 0)).toBe(1);
    expect(tickShown(29, 30, 3)).toBe(true);
    expect(tickShown(27, 30, 3)).toBe(false); // two slots from the last
    expect(tickShown(26, 30, 3)).toBe(false);
    expect(tickShown(24, 30, 3)).toBe(true);
    expect(tickShown(28, 30, 3)).toBe(false);
    expect(tickShown(12, 14, 3)).toBe(false); // too close to the last
    expect(tickShown(0, 1, 1)).toBe(true);
  });

  it("writes compact numbers in thousands, lakh and crore", () => {
    expect(compact(950)).toBe("950");
    expect(compact(9_999)).toBe("9,999");
    expect(compact(12_000)).toBe("12K");
    expect(compact(12_340)).toBe("12.3K");
    expect(compact(150_000)).toBe("1.5L");
    expect(compact(25_000_000)).toBe("2.5Cr");
    expect(compact(-12_000)).toBe("−12K");
    expect(compact(12_000, "bn")).toBe("১২ হা");
    expect(compact(150_000, "bn")).toBe("১.৫ লা");
    expect(compact(30_000_000, "bn")).toBe("৩ কো");
    expect(compactTaka(1_500_000)).toBe("৳15K");
    expect(compactTaka(-1_500_000)).toBe("−৳15K");
    // One unit per axis: under a 1.5L top, 50,000 reads 0.5L.
    expect(compact(50_000, "en", 150_000)).toBe("0.5L");
    expect(compact(0, "en", 150_000)).toBe("0");
    expect(compactTaka(5_000_000, "en", 15_000_000)).toBe("৳0.5L");
    expect(count(123456)).toBe("1,23,456");
    expect(count(12, "bn")).toBe("১২");
    expect(digits("2026", "en")).toBe("2026");
  });

  it("writes shares of a whole", () => {
    expect(share(1, 4)).toBe("25%");
    expect(share(1, 3)).toBe("33.3%");
    expect(share(1, 0)).toBe("0%");
    expect(share(1, 2, "bn")).toBe("৫০%");
  });
});

describe("changes against a previous figure", () => {
  it("is null with nothing to compare", () => {
    expect(pctChange(5, null)).toBeNull();
    expect(pctChange(null, 5)).toBeNull();
    expect(pctChange(undefined, 5)).toBeNull();
    expect(pctChange(5, undefined)).toBeNull();
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
    expect(pctChange(5, 5)).toBe(0);
  });

  it("rounds to whole percents, one decimal under ten", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(105, 100)).toBe(5);
    expect(pctChange(1053, 1000)).toBe(5.3);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(-50, -100)).toBe(50);
  });

  it("counts points between rates", () => {
    expect(ptsChange(12.5, 10)).toBe(2.5);
    expect(ptsChange(null, 10)).toBeNull();
    expect(ptsChange(10, null)).toBeNull();
    expect(ptsChange(undefined, 10)).toBeNull();
    expect(ptsChange(10, undefined)).toBeNull();
  });

  it("calls a change good or bad by which way is better", () => {
    expect(deltaTone(5)).toBe("good");
    expect(deltaTone(-5)).toBe("bad");
    expect(deltaTone(5, "down")).toBe("bad");
    expect(deltaTone(-5, "down")).toBe("good");
    expect(deltaTone(0)).toBe("flat");
    expect(deltaTone(5, "neither")).toBe("flat");
  });
});

describe("report periods", () => {
  const today = "2026-11-20";
  it("reads the presets and names a period's preset", () => {
    expect(presetPeriod("thisMonth", today, { month: "2026-01" })).toEqual({ month: "2026-11" });
    expect(presetPeriod("lastMonth", today, { month: "2026-01" })).toEqual({ month: "2026-10" });
    expect(presetPeriod("last7", today, { month: "2026-11" })).toEqual({ from: "2026-11-14", to: today });
    expect(presetPeriod("last30", today, { month: "2026-11" })).toEqual({ from: "2026-10-22", to: today });
    expect(presetPeriod("month", today, { month: "2026-03" })).toEqual({ month: "2026-03" });
    expect(presetPeriod("month", today, { from: "2026-09-02", to: "2026-09-09" })).toEqual({ month: "2026-09" });
    expect(presetPeriod("custom", today, { from: "2026-09-02", to: "2026-09-09" })).toEqual({ from: "2026-09-02", to: "2026-09-09" });
    expect(presetPeriod("custom", today, { month: "2026-11" })).toEqual({ from: "2026-11-01", to: today });
    expect(presetPeriod("custom", today, { month: "2026-02" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetOf({ month: "2026-11" }, today)).toBe("thisMonth");
    expect(presetOf({ month: "2026-10" }, today)).toBe("lastMonth");
    expect(presetOf({ month: "2026-02" }, today)).toBe("month");
    expect(presetOf({ from: "2026-11-14", to: today }, today)).toBe("last7");
    expect(presetOf({ from: "2026-10-22", to: today }, today)).toBe("last30");
    expect(presetOf({ from: "2026-10-22", to: "2026-11-01" }, today)).toBe("custom");
  });

  it("moves months across the year and finds their last day", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(lastOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("reads the URL safely and writes it back clean", () => {
    expect(periodFromParams({}, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ month: "2026-04" }, today)).toEqual({ month: "2026-04" });
    expect(periodFromParams({ month: "2027-01" }, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ month: "nope" }, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ from: "2026-11-01", to: "2026-11-10" }, today)).toEqual({ from: "2026-11-01", to: "2026-11-10" });
    expect(periodFromParams({ from: "2026-11-10", to: "2026-11-01" }, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ from: "2026-11-10", to: "2026-11-30" }, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ from: "2024-01-01", to: "2026-11-10" }, today)).toEqual({ month: "2026-11" });
    expect(periodFromParams({ from: "2026-11", to: "2026-11-10" }, today)).toEqual({ month: "2026-11" });
    expect(periodParams({ month: "2026-11" }, today)).toEqual({ month: null, from: null, to: null });
    expect(periodParams({ month: "2026-10" }, today)).toEqual({ month: "2026-10", from: null, to: null });
    expect(periodParams({ from: "2026-11-01", to: today }, today)).toEqual({ month: null, from: "2026-11-01", to: today });
  });
});
