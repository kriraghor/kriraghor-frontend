import { describe, expect, it } from "vitest";
import { canSeeReviews, decisionSeries, formatDuration, weekdayName } from "../admin/reviews";

// M19-FR-33: the staff review figures' helpers.
const word = (u: "d" | "h" | "m", n: number) => `${n} ${u === "m" ? "min" : u}`;

describe("canSeeReviews", () => {
  it("masters and staff who review see the figures; others do not", () => {
    expect(canSeeReviews({ isMaster: true, permissions: [] })).toBe(true);
    expect(canSeeReviews({ isMaster: false, permissions: ["approve_documents"] })).toBe(true);
    expect(canSeeReviews({ isMaster: false, permissions: ["manage_users", "approve_listings"] })).toBe(true);
    expect(canSeeReviews({ isMaster: false, permissions: ["manage_users", "view_analytics"] })).toBe(false);
  });
});

describe("formatDuration", () => {
  it("shows the two largest parts, minutes alone when short, and null as null", () => {
    expect(formatDuration(45, word)).toBe("45 min");
    expect(formatDuration(125, word)).toBe("2 h 5 min");
    expect(formatDuration(120, word)).toBe("2 h");
    expect(formatDuration(1440 + 4 * 60 + 30, word)).toBe("1 d 4 h");
    expect(formatDuration(2 * 1440 + 7, word)).toBe("2 d 7 min");
    expect(formatDuration(0, word)).toBe("0 min");
    expect(formatDuration(-3, word)).toBe("0 min");
    expect(formatDuration(null, word)).toBeNull();
    expect(formatDuration(undefined, word)).toBeNull();
  });
});

describe("weekdayName and decisionSeries", () => {
  it("names the weekday in the page language", () => {
    expect(weekdayName("2026-11-25")).toBe("Wednesday");
    expect(weekdayName("2026-11-25", "bn")).toBe("বুধবার");
  });
  it("turns the days into one series per decision, oldest first", () => {
    expect(
      decisionSeries([
        { day: "2026-11-24", approved: 2, changesRequested: 1, rejected: 0 },
        { day: "2026-11-25", approved: 0, changesRequested: 0, rejected: 3 },
      ]),
    ).toEqual({ days: ["2026-11-24", "2026-11-25"], approved: [2, 0], changes: [1, 0], rejected: [0, 3] });
  });
});
