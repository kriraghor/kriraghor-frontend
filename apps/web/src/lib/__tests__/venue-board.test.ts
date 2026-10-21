import { describe, expect, it } from "vitest";
import type { Availability } from "../bookings";
import { courtFor, estimate, hourSlots, pickHref, toggleHour } from "../venue-board";

/** A grid from compact rows: one string per court, one letter per half-hour from 17:00 (o open, b booked, y yours, p past, c closed). */
function grid(rows: Record<string, string>, rate = 100000): Availability {
  return {
    groundId: "g1",
    date: "2026-10-21",
    window: { from: "2026-10-21", to: "2026-10-28" },
    bookable: true,
    cutoffMin: 0,
    minBookingMin: 60,
    lengths: [60, 120],
    courts: Object.entries(rows).map(([id, row]) => ({
      id,
      name: id,
      combinableGroup: null,
      cells: [...row].map((ch, i) => {
        const h = 17 + Math.floor(i / 2);
        const m = i % 2 ? 30 : 0;
        const state = ({ o: "open", b: "booked", y: "yours", p: "past", c: "closed" } as const)[ch as "o"];
        return { start: `2026-10-21T${String(h - 6).padStart(2, "0")}:${m ? "30" : "00"}:00.000Z`, time: `${h}:${m ? "30" : "00"}`, state, rate: id === "c2" ? rate + 20000 : rate };
      }),
    })),
  } as Availability;
}

describe("hourSlots", () => {
  it("an hour is open when one court has both halves open, and takes the cheapest open court's rate", () => {
    const s = hourSlots(grid({ c1: "obbooo", c2: "oooobb" }));
    expect(s.map((x) => [x.hour, x.state, x.openCourts])).toEqual([
      [17, "open", ["c2"]],
      [18, "open", ["c2"]],
      [19, "open", ["c1"]],
    ]);
    expect(s[0].rate).toBe(120000); // only c2 open at 17
    expect(s[2].rate).toBe(100000);
  });

  it("a fully taken hour reads booked; your own booking wins; past and closed stay", () => {
    const s = hourSlots(grid({ c1: "bbyypp", c2: "bbccpp" }));
    expect(s.map((x) => x.state)).toEqual(["booked", "yours", "past"]);
    expect(s.every((x) => x.openCourts.length === 0)).toBe(true);
  });

  it("time of day keeps only its hours", () => {
    expect(hourSlots(grid({ c1: "oooooo" }), "evening").map((x) => x.hour)).toEqual([17, 18, 19]);
    expect(hourSlots(grid({ c1: "oooooo" }), "morning")).toEqual([]);
    expect(hourSlots(undefined)).toEqual([]);
  });
});

describe("toggleHour, the picked hours", () => {
  const slots = hourSlots(grid({ c1: "oooobb", c2: "bboooo" }));

  it("starts, grows at either end, shrinks from an end, and restarts elsewhere", () => {
    let p = toggleHour(null, "g1", 18, slots);
    expect(p).toEqual({ groundId: "g1", hours: [18] });
    p = toggleHour(p, "g1", 17, slots);
    expect(p?.hours).toEqual([17, 18]); // c1 is open at 17 and 18
    p = toggleHour(p, "g1", 17, slots);
    expect(p?.hours).toEqual([18]);
    expect(toggleHour(p, "g1", 18, slots)).toBeNull();
    expect(toggleHour({ groundId: "other", hours: [17] }, "g1", 19, slots)).toEqual({ groundId: "g1", hours: [19] });
  });

  it("never spans hours no single court has open throughout", () => {
    // 17 only on c1, 19 only on c2: 17–18 is one court, 17–19 is not.
    const two = toggleHour({ groundId: "g1", hours: [17, 18] }, "g1", 19, slots);
    expect(two).toEqual({ groundId: "g1", hours: [19] });
  });

  it("ignores a tap on an hour that is not open", () => {
    const booked = hourSlots(grid({ c1: "bboo" }));
    const p = { groundId: "g1", hours: [18] };
    expect(toggleHour(p, "g1", 17, booked)).toBe(p);
  });

  it("the court, the estimate and where Continue goes", () => {
    expect(courtFor([17, 18], slots)).toBe("c1");
    expect(courtFor([18, 19], slots)).toBe("c2");
    expect(estimate([17, 18], slots)).toBe(200000);
    expect(pickHref("dhanmondi-courts", { groundId: "g1", hours: [17, 18] }, slots)).toBe("/venues/dhanmondi-courts?court=c1&at=2026-10-21T11%3A00%3A00.000Z&len=120");
    expect(pickHref("x", { groundId: "g1", hours: [17, 19] }, slots)).toBeNull();
  });
});
