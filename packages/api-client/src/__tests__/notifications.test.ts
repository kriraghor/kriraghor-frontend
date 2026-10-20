import { describe, expect, it } from "vitest";
import { badgeText, relativeTime } from "../notifications";

describe("bell helpers (M08 §4.1)", () => {
  it("hides the badge at 0 and caps it at 99+", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-1)).toBeNull();
    expect(badgeText(7)).toBe("7");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
  });

  it("formats relative times in English and Bangla", () => {
    const now = Date.parse("2026-10-15T12:00:00Z");
    expect(relativeTime("2026-10-15T10:00:00Z", "en", now)).toBe("2 hours ago");
    expect(relativeTime("2026-10-15T11:59:30Z", "en", now)).toBe("30 seconds ago");
    expect(relativeTime("2026-10-14T12:00:00Z", "en", now)).toBe("yesterday");
    expect(relativeTime("2026-10-15T11:55:00Z", "bn", now)).toMatch(/[০-৯]/);
  });
});
