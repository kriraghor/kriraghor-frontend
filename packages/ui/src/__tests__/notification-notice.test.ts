import { describe, expect, it } from "vitest";
import { newestUnreadTitle, POLL_MS, pollPlan, shouldChime, titleWithUnread, titleWithoutUnread } from "../notifications/notice";

describe("shouldChime (M08 bell: only a rise in the unread count is news)", () => {
  it("never chimes on the first load, whatever the count", () => {
    expect(shouldChime(null, 0)).toBe(false);
    expect(shouldChime(null, 5)).toBe(false);
    expect(shouldChime(undefined, 3)).toBe(false);
  });

  it("chimes when the count goes up", () => {
    expect(shouldChime(0, 1)).toBe(true);
    expect(shouldChime(3, 4)).toBe(true);
    expect(shouldChime(2, 7)).toBe(true);
  });

  it("stays quiet when the count goes down (read elsewhere) or stays the same (the re-read after an event)", () => {
    expect(shouldChime(4, 3)).toBe(false);
    expect(shouldChime(1, 0)).toBe(false);
    expect(shouldChime(3, 3)).toBe(false);
    expect(shouldChime(0, 0)).toBe(false);
  });

  it("ignores a missing count (an event whose count lookup failed)", () => {
    expect(shouldChime(2, null)).toBe(false);
    expect(shouldChime(2, undefined)).toBe(false);
    expect(shouldChime(2, Number.NaN)).toBe(false);
    expect(shouldChime(Number.NaN, 2)).toBe(false);
  });

  it("chimes once for one change: the realtime count, then the same count from the re-read", () => {
    let seen: number | null = null;
    const observe = (n: number) => {
      const rise = shouldChime(seen, n);
      seen = n;
      return rise;
    };
    expect([observe(2), observe(3), observe(3), observe(1), observe(2)]).toEqual([false, true, false, false, true]);
  });
});

describe("titleWithUnread (hidden tab title count)", () => {
  it("prefixes the count, and replaces an old prefix instead of stacking", () => {
    expect(titleWithUnread("Kriraghor", 3)).toBe("(3) Kriraghor");
    expect(titleWithUnread("(3) Kriraghor", 4)).toBe("(4) Kriraghor");
    expect(titleWithUnread("(99+) Kriraghor", 5)).toBe("(5) Kriraghor");
  });

  it("caps at 99+ and drops the prefix at 0", () => {
    expect(titleWithUnread("Kriraghor", 150)).toBe("(99+) Kriraghor");
    expect(titleWithUnread("(3) Kriraghor", 0)).toBe("Kriraghor");
    expect(titleWithUnread("Kriraghor", 0)).toBe("Kriraghor");
  });

  it("restores the plain title, leaving brackets elsewhere alone", () => {
    expect(titleWithoutUnread("(12) Venues · Kriraghor")).toBe("Venues · Kriraghor");
    expect(titleWithoutUnread("Venues (Mirpur) · Kriraghor")).toBe("Venues (Mirpur) · Kriraghor");
    expect(titleWithoutUnread("(beta) Kriraghor")).toBe("(beta) Kriraghor");
  });
});

describe("pollPlan (fallback polling while realtime is down)", () => {
  it("polls every 30 s and on focus when signed in and the socket is not connected", () => {
    expect(POLL_MS).toBe(30_000);
    expect(pollPlan(true, false)).toEqual({ intervalMs: 30_000, onFocus: true });
  });

  it("stops polling while the socket is connected", () => {
    expect(pollPlan(true, true)).toEqual({ intervalMs: false, onFocus: false });
  });

  it("never polls when signed out", () => {
    expect(pollPlan(false, false)).toEqual({ intervalMs: false, onFocus: false });
    expect(pollPlan(false, true)).toEqual({ intervalMs: false, onFocus: false });
  });
});

describe("newestUnreadTitle (what the announcement names)", () => {
  it("takes the first unread item of the newest-first list", () => {
    expect(
      newestUnreadTitle([
        { title: "Old, read", readAt: "2026-10-22T08:00:00Z" },
        { title: "Hire request from Rafi", readAt: null },
        { title: "Older unread", readAt: null },
      ])
    ).toBe("Hire request from Rafi");
  });

  it("is undefined when nothing is unread or the list is missing", () => {
    expect(newestUnreadTitle([{ title: "Read", readAt: "2026-10-22T08:00:00Z" }])).toBeUndefined();
    expect(newestUnreadTitle([])).toBeUndefined();
    expect(newestUnreadTitle(undefined)).toBeUndefined();
  });
});
