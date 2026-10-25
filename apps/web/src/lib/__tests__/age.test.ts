import { describe, expect, it } from "vitest";
import { latestDobForAge } from "../age";

describe("latestDobForAge (M02 §6.3 age_ok, 18+)", () => {
  it("counts from today on the Dhaka calendar (UTC+6)", () => {
    expect(latestDobForAge(18, new Date("2026-10-25T17:59:59Z"))).toBe("2008-10-25");
    expect(latestDobForAge(18, new Date("2026-10-25T18:00:00Z"))).toBe("2008-10-26");
    expect(latestDobForAge(18, new Date("2026-12-31T18:00:00Z"))).toBe("2009-01-01");
  });

  it("works for other minimum ages", () => {
    expect(latestDobForAge(21, new Date("2026-10-25T06:00:00Z"))).toBe("2005-10-25");
    expect(latestDobForAge(0, new Date("2026-10-25T06:00:00Z"))).toBe("2026-10-25");
  });

  it("turns 29 February into 28 February when the target year has none", () => {
    expect(latestDobForAge(18, new Date("2028-02-29T06:00:00Z"))).toBe("2010-02-28");
    // 29 Feb in Dhaka starts at 18:00 UTC on 28 Feb.
    expect(latestDobForAge(18, new Date("2028-02-28T18:00:00Z"))).toBe("2010-02-28");
    expect(latestDobForAge(18, new Date("2028-02-28T17:59:59Z"))).toBe("2010-02-28");
  });

  it("keeps 29 February when the target year is a leap year", () => {
    expect(latestDobForAge(20, new Date("2028-02-29T06:00:00Z"))).toBe("2008-02-29");
    expect(latestDobForAge(28, new Date("2028-02-29T06:00:00Z"))).toBe("2000-02-29"); // 2000 is a leap year
    expect(latestDobForAge(128, new Date("2028-02-29T06:00:00Z"))).toBe("1900-02-28"); // 1900 is not
  });

  it("leaves someone born on 29 Feb under age on 28 Feb (as the server counts)", () => {
    expect(latestDobForAge(18, new Date("2026-02-28T06:00:00Z"))).toBe("2008-02-28");
    expect("2008-02-29" > latestDobForAge(18, new Date("2026-02-28T06:00:00Z"))).toBe(true);
    expect(latestDobForAge(18, new Date("2026-03-01T06:00:00Z"))).toBe("2008-03-01");
  });
});
