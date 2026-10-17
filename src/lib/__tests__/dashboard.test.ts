import { describe, expect, it } from "vitest";
import { bucketLabel, compactTaka, hourLabel, pct } from "../dashboard";

describe("dashboard helpers (M19)", () => {
  it("taka in lakh and crore from ৳1 lakh up (FR-07)", () => {
    expect(compactTaka(43_000_000)).toBe("৳4.3 lakh");
    expect(compactTaka(10_000_000)).toBe("৳1 lakh");
    expect(compactTaka(2_500_000_000)).toBe("৳2.5 crore");
    expect(compactTaka(200000)).toBe("৳2,000");
    expect(compactTaka(43_000_000, "bn")).toBe("৳৪.৩ লাখ");
    expect(compactTaka(null)).toBe("–");
  });

  it("rates, buckets and hours", () => {
    expect(pct(0.382)).toBe("38%");
    expect(pct(0.0625)).toBe("6.3%");
    expect(pct(0.05)).toBe("5%");
    expect(pct(null)).toBe("–");
    expect(pct(0.5, "bn")).toBe("৫০%");
    expect(bucketLabel("2026-10-12")).toBe("12 Oct");
    expect(bucketLabel("2026-10")).toBe("Oct 26");
    expect(hourLabel(18)).toBe("6 pm");
  });
});
