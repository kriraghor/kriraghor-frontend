import { describe, expect, it } from "vitest";
import { bestTimeText, CALL_TIMES, nextTo } from "../call-time";

// Tester feedback, 28 Nov 2026: "Best time to call" is a From–To pair of half-hour times.
describe("best time to call", () => {
  it("offers every half hour from 06:00 to 23:00", () => {
    expect(CALL_TIMES[0]).toBe("06:00");
    expect(CALL_TIMES[1]).toBe("06:30");
    expect(CALL_TIMES.at(-1)).toBe("23:00");
    expect(CALL_TIMES).toHaveLength(35);
  });

  it("sends a range, a single time, or nothing for any time", () => {
    expect(bestTimeText("18:00", "20:00")).toBe("18:00–20:00");
    expect(bestTimeText("18:00", "")).toBe("18:00");
    expect(bestTimeText("18:00", "17:00")).toBe("18:00");
    expect(bestTimeText("", "20:00")).toBeNull();
    expect(bestTimeText("18:00", "20:00")!.length).toBeLessThanOrEqual(40);
  });

  it("keeps a later To, else moves it two hours on, never past 23:00", () => {
    expect(nextTo("18:00", "21:00")).toBe("21:00");
    expect(nextTo("18:00", "")).toBe("20:00");
    expect(nextTo("18:00", "17:30")).toBe("20:00");
    expect(nextTo("22:00", "")).toBe("23:00");
    expect(nextTo("22:30", "22:00")).toBe("23:00");
    expect(nextTo("", "20:00")).toBe("");
  });
});
