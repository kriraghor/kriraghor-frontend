import { describe, expect, it } from "vitest";
import { countdown, ctaFor, fill, pad, safeNext, taka } from "../esports";

describe("esports helpers (M21)", () => {
  it("formats poisha as taka in English and Bangla", () => {
    expect(taka(100000, "en")).toBe("৳1,000");
    expect(taka(5050, "en")).toBe("৳50.5");
    expect(taka(100000, "bn")).toBe("৳১,০০০");
  });

  it("counts down to zero, never below", () => {
    const now = Date.parse("2026-10-20T13:00:00Z");
    expect(countdown("2026-10-21T14:01:05Z", now)).toMatchObject({ d: 1, h: 1, m: 1, s: 5 });
    expect(countdown("2026-10-20T12:00:00Z", now).total).toBe(0);
    expect(pad(7)).toBe("07");
  });

  it("chooses the call to action from the tournament and my entry", () => {
    const open = { status: "registration_open", slotsTaken: 3, maxSlots: 4 };
    expect(ctaFor(open, null)).toBe("register");
    expect(ctaFor({ ...open, slotsTaken: 4 }, null)).toBe("waitlist");
    expect(ctaFor(open, { status: "pending_payment" } as never)).toBe("pay");
    expect(ctaFor(open, { status: "waitlisted" } as never)).toBe("view_entry");
    expect(ctaFor({ ...open, status: "scheduled" }, null)).toBe("soon");
    expect(ctaFor({ ...open, status: "registration_closed" }, null)).toBe("closed");
    expect(ctaFor({ ...open, status: "paid_out" }, null)).toBe("results");
  });

  it("caps the slots bar at 100%", () => {
    expect(fill(3, 4)).toBe(75);
    expect(fill(5, 4)).toBe(100);
    expect(fill(0, 0)).toBe(0);
  });
});

describe("sign-in return path", () => {
  it("only follows a relative path on this site", () => {
    expect(safeNext("/t/ff-daily")).toBe("/t/ff-daily");
    expect(safeNext("//evil.example")).toBe("/me");
    expect(safeNext("https://evil.example")).toBe("/me");
    expect(safeNext(null)).toBe("/me");
  });
});
