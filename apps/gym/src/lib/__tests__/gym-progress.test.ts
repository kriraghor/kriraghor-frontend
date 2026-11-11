import { describe, expect, it } from "vitest";
import { BODY_FIELDS, bodyValues, chartPoints, chartRange, emptyDraft, fieldsWithData, firstChoice, firstPay, measureOf, renewState, seriesOf, type BodyEntry, type BodyProgress, type RenewalChoice } from "../gym-progress";
import { draftOf, settingsPatch, type GymSettings } from "../gym-manage";

describe("a member renews by themselves (M24-FR-121 to FR-125)", () => {
  const base = { can: false, reason: null, renewal: null, opensOn: null };
  const waiting = { membershipId: "m2", title: "Monthly", packageKind: "month" as const, startsOn: "2026-11-21", endsOn: "2026-12-20", createdVia: "member" as const, dueId: "d2", amountPoisha: 250000, outstandingPoisha: 250000, cancellable: true };

  it("shows the card that fits where the member stands", () => {
    expect(renewState({ ...base, can: true })).toEqual({ kind: "renew" });
    expect(renewState({ ...base, reason: "GYM_RENEWAL_EXISTS", renewal: waiting })).toEqual({ kind: "waiting" });
    expect(renewState({ ...base, reason: "GYM_RENEW_TOO_EARLY", opensOn: "2026-11-26" })).toEqual({ kind: "later", on: "2026-11-26" });
    expect(renewState({ ...base, reason: "GYM_SELF_RENEW_OFF" })).toEqual({ kind: "desk" });
    // Left, removed or nothing to renew: no card at all.
    expect(renewState({ ...base, reason: "GYM_MEMBER_STATE" })).toEqual({ kind: "none" });
    expect(renewState({ ...base, reason: "GYM_NOTHING_TO_RENEW" })).toEqual({ kind: "none" });
  });

  it("starts on the current package and on online payment when the gym takes it", () => {
    const pkg = (packageId: string, current: boolean): RenewalChoice => ({ packageId, title: packageId, kind: "month", days: 30, pricePoisha: 250000, startsOn: "2026-11-21", endsOn: "2026-12-20", current });
    expect(firstChoice([pkg("q", false), pkg("m", true)])?.packageId).toBe("m");
    expect(firstChoice([pkg("q", false), pkg("y", false)])?.packageId).toBe("q");
    expect(firstChoice([])).toBeNull();
    expect(firstPay({ onlineFees: true })).toBe("online");
    expect(firstPay({ onlineFees: false })).toBe("counter");
  });

  it("sends the gym's switch only when it changed", () => {
    const s = { shortCode: "PM", tin: null, bin: null, receiptFooter: null, entryPolicy: "warn", absentAlertDays: null, joinRequestsOpen: true, vatEnabled: false, vatBps: null, visitsOpen: false, visitDailyCap: null, visitPerPerson: 1, visitNote: null, selfRenewOpen: true } as unknown as GymSettings;
    expect(settingsPatch(s, draftOf(s))).toEqual({});
    expect(settingsPatch(s, { ...draftOf(s), selfRenewOpen: false })).toEqual({ selfRenewOpen: false });
  });
});

describe("body progress (M24-FR-128 to FR-130)", () => {
  const limits: BodyProgress["limits"]["fields"] = {
    weightKg: { min: 10, max: 400 },
    bodyFatPct: { min: 2, max: 70 },
    chestCm: { min: 10, max: 300 },
    waistCm: { min: 10, max: 300 },
    hipsCm: { min: 10, max: 300 },
    armCm: { min: 10, max: 300 },
    thighCm: { min: 10, max: 300 },
  };
  const entry = (measuredOn: string, x: Partial<BodyEntry> = {}): BodyEntry => ({ id: measuredOn, measuredOn, weightKg: null, bodyFatPct: null, chestCm: null, waistCm: null, hipsCm: null, armCm: null, thighCm: null, byRole: "member", createdAt: `${measuredOn}T06:00:00.000+00:00`, bmi: null, ...x });

  it("reads a typed measurement in English or Bangla digits, with a point or a comma", () => {
    expect(measureOf("78.4")).toBe(78.4);
    expect(measureOf(" 82 ")).toBe(82);
    expect(measureOf("৭৮.৪")).toBe(78.4);
    expect(measureOf("78,4")).toBe(78.4);
    expect(measureOf("")).toBeUndefined();
    expect(measureOf("   ")).toBeUndefined();
    expect(measureOf("78.45")).toBeNull();
    expect(measureOf("abc")).toBeNull();
    expect(measureOf("-5")).toBeNull();
    expect(measureOf("1234")).toBeNull();
  });

  it("turns the form into what is sent, and names what is wrong", () => {
    expect(bodyValues(emptyDraft(), limits)).toEqual({ values: {}, bad: [], empty: true });
    expect(bodyValues({ ...emptyDraft(), weightKg: "78.4", waistCm: "90" }, limits)).toEqual({ values: { weightKg: 78.4, waistCm: 90 }, bad: [], empty: false });
    // Outside the range, or not a number: named, not sent, and the form is not "empty".
    expect(bodyValues({ ...emptyDraft(), weightKg: "5", bodyFatPct: "71", armCm: "x", thighCm: "55" }, limits)).toEqual({ values: { thighCm: 55 }, bad: ["weightKg", "bodyFatPct", "armCm"], empty: false });
    expect(bodyValues({ ...emptyDraft(), weightKg: "10", bodyFatPct: "70" }, limits).bad).toEqual([]);
  });

  it("offers only the measurements that have entries, in the fixed order", () => {
    const entries = [entry("2026-09-01", { waistCm: 94.5, weightKg: 82 }), entry("2026-10-01", { armCm: 33 }), entry("2026-11-01", { weightKg: 78.4 })];
    expect(fieldsWithData(entries)).toEqual(["weightKg", "waistCm", "armCm"]);
    expect(fieldsWithData([])).toEqual([]);
    expect(seriesOf(entries, "weightKg")).toEqual([
      { date: "2026-09-01", value: 82 },
      { date: "2026-11-01", value: 78.4 },
    ]);
    expect(seriesOf(entries, "hipsCm")).toEqual([]);
    expect(BODY_FIELDS).toHaveLength(7);
  });

  it("gives the chart a range that hugs the values, and room around a flat line", () => {
    expect(chartRange([82, 78.4, 80])).toEqual({ min: 77.8, max: 82.6 });
    expect(chartRange([70, 70])).toEqual({ min: 69, max: 71 });
    expect(chartRange([55.5])).toEqual({ min: 54.5, max: 56.5 });
  });

  it("places points by date, so a long gap looks long, and higher values higher", () => {
    const box = { w: 600, h: 200, pad: 28 };
    const pts = chartPoints(
      [
        { date: "2026-09-01", value: 82 },
        { date: "2026-09-11", value: 80 },
        { date: "2026-12-10", value: 78 },
      ],
      box
    );
    expect(pts[0]!.x).toBe(28);
    expect(pts[2]!.x).toBe(572);
    // Ten of a hundred days: a tenth of the way across.
    expect(pts[1]!.x).toBeCloseTo(28 + 54.4, 5);
    expect(pts[0]!.y).toBeLessThan(pts[1]!.y);
    expect(pts[1]!.y).toBeLessThan(pts[2]!.y);
    expect(pts.every((p) => p.y >= 28 && p.y <= 172)).toBe(true);
    // One point, or every entry on one day, sits in the middle; no entries, no points.
    expect(chartPoints([{ date: "2026-09-01", value: 70 }], box)).toEqual([{ x: 300, y: 100 }]);
    expect(chartPoints([], box)).toEqual([]);
  });
});
