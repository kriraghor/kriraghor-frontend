import { describe, expect, it } from "vitest";
import { dhakaDate, formatTaka, isTab, parseTaka } from "../admin/finance";

describe("finance desk helpers (M06 §4)", () => {
  it("parses taka typed by a person into poisha without floats", () => {
    expect(parseTaka("100")).toBe(10000);
    expect(parseTaka("1,234.5")).toBe(123450);
    expect(parseTaka(" 0.05 ")).toBe(5);
    expect(parseTaka("12.345")).toBeNull();
    expect(parseTaka("-5")).toBeNull();
    expect(parseTaka("abc")).toBeNull();
    expect(parseTaka("")).toBeNull();
  });

  it("formats poisha as taka in English and Bangla digits", () => {
    expect(formatTaka(9500)).toBe("৳95");
    expect(formatTaka(12345678)).toBe("৳1,23,456.78");
    expect(formatTaka(350, "bn")).toBe("৳৩.৫০");
    expect(formatTaka(-100)).toBe("−৳1");
    expect(formatTaka(null)).toBe("–");
  });

  it("knows its tabs and the Dhaka business day", () => {
    expect(isTab("refunds")).toBe(true);
    expect(isTab("nope")).toBe(false);
    expect(isTab(null)).toBe(false);
    expect(dhakaDate(Date.parse("2026-10-19T19:00:00Z"))).toBe("2026-10-20");
    expect(dhakaDate(Date.parse("2026-10-19T17:59:00Z"))).toBe("2026-10-19");
  });
});
