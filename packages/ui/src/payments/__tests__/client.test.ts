import { describe, expect, it } from "vitest";
import { countdown, formatTaka, outcomeOf } from "../client";

describe("payments helpers (M06 §4)", () => {
  it("formats poisha as taka with Indian grouping, in English and Bangla digits", () => {
    expect(formatTaka(10000)).toBe("৳100");
    expect(formatTaka(12345678)).toBe("৳1,23,456.78");
    expect(formatTaka(5, "bn")).toBe("৳০.০৫");
    expect(formatTaka(-150)).toBe("−৳1.50");
  });

  it("maps payment statuses to what the result page shows", () => {
    expect(outcomeOf("succeeded")).toBe("paid");
    expect(outcomeOf("partially_refunded")).toBe("paid");
    expect(outcomeOf("refunded")).toBe("paid");
    expect(outcomeOf("initiated")).toBe("waiting");
    expect(outcomeOf("pending")).toBe("waiting");
    expect(outcomeOf("expired")).toBe("expired");
    expect(outcomeOf("cancelled")).toBe("expired");
    expect(outcomeOf("failed")).toBe("failed");
  });

  it("counts down to the expiry and never goes negative", () => {
    const now = Date.parse("2026-10-19T10:00:00Z");
    expect(countdown("2026-10-19T10:09:41Z", now)).toBe("9:41");
    expect(countdown("2026-10-19T10:00:05Z", now)).toBe("0:05");
    expect(countdown("2026-10-19T09:59:00Z", now)).toBe("0:00");
  });
});
