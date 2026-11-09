import { describe, expect, it } from "vitest";
import { bookableDays, codeGroups, dhakaMinuteNow, splitVisits, visitAhead, visitTimes, type MyVisit } from "../gym-visits";

describe("trial visit times (M24-FR-111)", () => {
  const windows = [
    { openTime: "06:00", closeTime: "08:00", womenOnly: false },
    { openTime: "17:15", closeTime: "19:00", womenOnly: true },
  ];
  it("every half hour inside each window; the close time is not inside", () => {
    expect(visitTimes(windows)).toEqual(["06:00", "06:30", "07:00", "07:30", "17:30", "18:00", "18:30"]);
  });
  it("today, only times still ahead", () => {
    expect(visitTimes(windows, { isToday: true, nowMinute: 7 * 60 })).toEqual(["07:30", "17:30", "18:00", "18:30"]);
    expect(visitTimes(windows, { isToday: true, nowMinute: 19 * 60 })).toEqual([]);
  });
  it("overlapping windows give each time once; open till midnight", () => {
    expect(visitTimes([{ openTime: "22:00", closeTime: "24:00" }, { openTime: "23:00", closeTime: "24:00" }])).toEqual(["22:00", "22:30", "23:00", "23:30"]);
    expect(visitTimes([])).toEqual([]);
  });
  it("days that can still be picked", () => {
    const days = [
      { date: "2026-11-09", windows, placesLeft: 2 },
      { date: "2026-11-10", windows, placesLeft: 0 },
      { date: "2026-11-11", windows, placesLeft: 1 },
    ];
    expect(bookableDays(days, { today: "2026-11-09", nowMinute: 20 * 60 }).map((d) => d.date)).toEqual(["2026-11-11"]);
    expect(bookableDays(days, { today: "2026-11-09", nowMinute: 6 * 60 }).map((d) => d.date)).toEqual(["2026-11-09", "2026-11-11"]);
  });
  it("the Dhaka clock", () => {
    expect(dhakaMinuteNow(new Date("2026-11-09T00:00:00Z"))).toBe(360);
    expect(dhakaMinuteNow(new Date("2026-11-09T18:30:00Z"))).toBe(30);
  });
});

describe("my visits (M24-FR-112)", () => {
  const v = (o: Partial<MyVisit>): MyVisit => ({ id: "x", gym: null, date: "2026-11-10", arriveAt: "18:00", status: "booked", code: "ABC123", token: "v1.gv.t", cancelledBy: null, cancelReason: null, attendedAt: null, createdAt: "2026-11-09T00:00:00Z", ...o });
  it("still ahead", () => {
    const now = { today: "2026-11-10", nowMinute: 17 * 60 };
    expect(visitAhead(v({}), now)).toBe(true);
    expect(visitAhead(v({ arriveAt: "16:00" }), now)).toBe(false);
    expect(visitAhead(v({ date: "2026-11-11", arriveAt: "06:00" }), now)).toBe(true);
    expect(visitAhead(v({ date: "2026-11-09" }), now)).toBe(false);
    expect(visitAhead(v({ status: "cancelled" }), now)).toBe(false);
  });
  it("coming soonest first, the rest after", () => {
    const a = v({ id: "a", date: "2026-11-12" });
    const b = v({ id: "b", date: "2026-11-10", arriveAt: "07:00" });
    const c = v({ id: "c", status: "attended", token: null, code: null });
    const s = splitVisits([a, c, b]);
    expect(s.coming.map((x) => x.id)).toEqual(["b", "a"]);
    expect(s.past.map((x) => x.id)).toEqual(["c"]);
  });
  it("the code in two groups", () => expect(codeGroups("ABC123")).toBe("ABC 123"));
});
