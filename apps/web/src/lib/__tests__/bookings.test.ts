import { describe, expect, it } from "vitest";
import { canStartAt, coveredIndexes, dayLabel, daysBetween, dhakaDate, timeLabel } from "../bookings";

describe("bookings helpers (M10)", () => {
  it("works on Dhaka dates (UTC+6)", () => {
    expect(dhakaDate("2026-10-18T17:59:00Z")).toBe("2026-10-18");
    expect(dhakaDate("2026-10-18T18:00:00Z")).toBe("2026-10-19");
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daysBetween("2026-10-30", "2026-10-29")).toEqual([]);
  });

  it("labels days and times", () => {
    expect(dayLabel("2026-10-18", "en")).toBe("Sun 18");
    expect(timeLabel("2026-10-18T12:30:00Z", "en")).toBe("6:30 pm");
  });

  it("a start needs every half-hour of the length open (FR-01)", () => {
    const cells = ["open", "open", "booked", "open", "open", "open"].map((state) => ({ state }) as { state: "open" | "booked" });
    expect(canStartAt(cells, 0, 60)).toBe(true);
    expect(canStartAt(cells, 1, 60)).toBe(false); // runs into a booked half-hour
    expect(canStartAt(cells, 3, 90)).toBe(true);
    expect(canStartAt(cells, 4, 90)).toBe(false); // past the end of the day
    expect(canStartAt(cells, -1, 60)).toBe(false);
    expect(canStartAt(cells, 0, 45)).toBe(false);
    expect([...coveredIndexes(3, 90)]).toEqual([3, 4, 5]);
    expect(coveredIndexes(null, 60).size).toBe(0);
  });
});
