import { describe, expect, it } from "vitest";
import { minutesUntil, pinProblem, touchDue, TOUCH_EVERY_MS } from "../desk";

// M24 §21 desk mode: the PIN rule mirrors the server's (M24-FR-134), the waits and the touch throttle.
describe("pinProblem", () => {
  it("takes four digits that are not too easy", () => {
    expect(pinProblem("4826")).toBeNull();
    expect(pinProblem("1357")).toBeNull();
    expect(pinProblem("2580")).toBeNull();
  });
  it("refuses anything but four digits", () => {
    expect(pinProblem("")).toBe("format");
    expect(pinProblem("123")).toBe("format");
    expect(pinProblem("12345")).toBe("format");
    expect(pinProblem("12a4")).toBe("format");
  });
  it("refuses one digit four times and runs up or down", () => {
    expect(pinProblem("0000")).toBe("repeat");
    expect(pinProblem("7777")).toBe("repeat");
    expect(pinProblem("1234")).toBe("run");
    expect(pinProblem("0123")).toBe("run");
    expect(pinProblem("9876")).toBe("run");
    expect(pinProblem("6543")).toBe("run");
    expect(pinProblem("1235")).toBeNull();
  });
  it("refuses the last four digits of the person's own phone", () => {
    expect(pinProblem("5829", "+8801711345829")).toBe("phone");
    expect(pinProblem("5820", "01711-345829")).toBeNull();
    expect(pinProblem("4826", null)).toBeNull();
  });
});

describe("minutesUntil", () => {
  const now = Date.parse("2026-11-17T10:00:00Z");
  it("rounds up and stops at zero", () => {
    expect(minutesUntil("2026-11-17T10:14:01Z", now)).toBe(15);
    expect(minutesUntil("2026-11-17T10:00:30Z", now)).toBe(1);
    expect(minutesUntil("2026-11-17T09:59:00Z", now)).toBe(0);
    expect(minutesUntil(null, now)).toBe(0);
  });
});

describe("touchDue", () => {
  it("sends at most one touch per interval", () => {
    expect(touchDue(0, TOUCH_EVERY_MS)).toBe(true);
    expect(touchDue(1000, 1000 + TOUCH_EVERY_MS - 1)).toBe(false);
    expect(touchDue(1000, 1000 + TOUCH_EVERY_MS)).toBe(true);
  });
});
