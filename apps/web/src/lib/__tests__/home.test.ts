import { describe, expect, it } from "vitest";
import { bookingHref, countdown, dhakaDateOf, filled, finderUrl, freeHours, hourOf, initials, nextTab, podium } from "../home";

const cell = (time: string, state = "open") => ({ start: `2026-10-19T${time}:00+06:00`, time, state });

describe("home (launch polish)", () => {
  it("reads the Dhaka date of an instant (UTC+6)", () => {
    expect(dhakaDateOf("2026-10-18T17:59:59Z")).toBe("2026-10-18");
    expect(dhakaDateOf("2026-10-18T18:00:00Z")).toBe("2026-10-19");
  });

  it("counts down to the start, with days when far away, and stops once started", () => {
    const start = "2026-10-19T12:00:00Z";
    expect(countdown(start, Date.parse("2026-10-19T10:17:51Z"))).toBe("01:42:09");
    expect(countdown(start, Date.parse("2026-10-17T08:50:00Z"))).toBe("2d 03:10");
    expect(countdown(start, Date.parse(start))).toBeNull();
    expect(countdown("not a date", 0)).toBeNull();
  });

  it("builds finder links with only the filters each page supports", () => {
    expect(finderUrl("tournaments", { game: "free_fire" })).toBe("/go/esports/events?game=free_fire");
    expect(finderUrl("tournaments", {})).toBe("/go/esports/events");
    expect(finderUrl("grounds", { sport: "football", areaId: "a1" })).toBe("/venues?sport=football&areaId=a1");
    expect(finderUrl("shop", { q: "  whey protein " })).toBe("/shop?q=whey+protein");
    expect(finderUrl("shop", { q: "   " })).toBe("/shop");
    expect(finderUrl("hire", { category: "officials" })).toBe("/hiring?category=officials");
  });

  it("moves between finder tabs with the arrow keys, Home and End", () => {
    expect(nextTab(0, "ArrowRight", 4)).toBe(1);
    expect(nextTab(3, "ArrowRight", 4)).toBe(0);
    expect(nextTab(0, "ArrowLeft", 4)).toBe(3);
    expect(nextTab(2, "ArrowUp", 4)).toBe(1);
    expect(nextTab(2, "ArrowDown", 4)).toBe(3);
    expect(nextTab(2, "Home", 4)).toBe(0);
    expect(nextTab(1, "End", 4)).toBe(3);
    expect(nextTab(1, "Enter", 4)).toBeNull();
  });

  it("finds tonight's free hours: two open half-hours in a row, one per time, in order", () => {
    const a = {
      courts: [
        { id: "c1", cells: [cell("16:00"), cell("16:30"), cell("18:00"), cell("18:30", "booked"), cell("19:00"), cell("19:30"), cell("21:00"), cell("21:30")] },
        { id: "c2", cells: [cell("18:00"), cell("18:30"), cell("19:00"), cell("19:30"), cell("20:00", "past"), cell("20:30"), cell("22:00"), cell("22:30")] },
      ],
    };
    expect(freeHours(a)).toEqual([
      { courtId: "c2", start: "2026-10-19T18:00:00+06:00", time: "18:00" },
      { courtId: "c1", start: "2026-10-19T19:00:00+06:00", time: "19:00" },
      { courtId: "c1", start: "2026-10-19T21:00:00+06:00", time: "21:00" },
    ]);
    expect(freeHours(a, { from: "22:00" })).toEqual([{ courtId: "c2", start: "2026-10-19T22:00:00+06:00", time: "22:00" }]);
    expect(freeHours({ courts: [{ id: "c", cells: [cell("19:30"), cell("20:00")] }] })).toEqual([]);
    expect(freeHours(null)).toEqual([]);
  });

  it("labels hours in English and Bangla", () => {
    expect(hourOf("18:00", "en")).toBe("6 pm");
    expect(hourOf("00:30", "en")).toBe("12:30 am");
    expect(hourOf("12:00", "en")).toBe("12 pm");
    expect(hourOf("21:00", "bn")).toBe("৯টা");
    expect(hourOf("09:30", "bn")).toBe("৯:৩০");
  });

  it("links a picked hour to the booking widget without personal data", () => {
    expect(bookingHref("mirpur-turf-10", { courtId: "c1", start: "2026-10-19T18:00:00+06:00", time: "18:00" })).toBe("/venues/mirpur-turf-10?court=c1&at=2026-10-19T18%3A00%3A00%2B06%3A00");
  });

  it("makes initials, a fill ratio and the prize podium", () => {
    expect(initials("Kamrul Islam")).toBe("KI");
    expect(initials("  nusrat  ")).toBe("N");
    expect(initials("সাকিব হাসান")).toBe("সহ");
    expect(initials("")).toBe("?");
    expect(filled(32, 48)).toBeCloseTo(0.667, 3);
    expect(filled(60, 48)).toBe(1);
    expect(filled(1, 0)).toBe(0);
    const prize = (place: number, amount: number) => ({ place, amount: { amount } });
    expect(podium([prize(3, 30000), prize(1, 100000), prize(4, 10000), prize(2, 60000)]).map((p) => p.place)).toEqual([1, 2, 3]);
    expect(podium(null)).toEqual([]);
  });
});
