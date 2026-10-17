import { describe, expect, it } from "vitest";
import { hoursLeft } from "../vendor/orders";

describe("vendor orders (M13)", () => {
  it("counts whole hours to a deadline, negative once late, null without one", () => {
    const now = Date.parse("2026-10-17T06:00:00Z");
    expect(hoursLeft("2026-10-18T06:00:00Z", now)).toBe(24);
    expect(hoursLeft("2026-10-17T09:59:00Z", now)).toBe(3);
    expect(hoursLeft("2026-10-17T05:00:00Z", now)).toBe(-1);
    expect(hoursLeft(null, now)).toBeNull();
  });
});
