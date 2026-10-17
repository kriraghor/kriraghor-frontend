import { describe, expect, it } from "vitest";
import { blockColumns, dhakaMinute, hhmm, ownerActions, timelineWindow } from "../vendor/bookings";

const money = (dueAtVenue = 150000, balanceStatus: "due" | "collected" | "not_due" = "due") => ({ dueAtVenue, balanceStatus }) as never;

describe("vendor bookings helpers (M10)", () => {
  it("places blocks on the 06:00–23:00 half-hour timeline", () => {
    // 18:00–19:30 Dhaka = 12:00–13:30 UTC → columns 25..27
    expect(blockColumns("2026-10-19T12:00:00Z", "2026-10-19T13:30:00Z", "2026-10-19")).toEqual({ from: 25, span: 3 });
    // clipped at the open: 05:00–07:00 Dhaka shows 06:00–07:00
    expect(blockColumns("2026-10-18T23:00:00Z", "2026-10-19T01:00:00Z", "2026-10-19")).toEqual({ from: 1, span: 2 });
    // another day
    expect(blockColumns("2026-10-20T12:00:00Z", "2026-10-20T13:00:00Z", "2026-10-19")).toBeNull();
    expect(dhakaMinute("2026-10-19T12:30:00Z")).toBe(18 * 60 + 30);
    expect(hhmm("2026-10-19T00:00:00Z")).toBe("06:00");
  });

  it("offers the owner actions the windows allow (FR-13 to FR-20)", () => {
    const start = Date.parse("2026-10-19T12:00:00Z");
    const b = { status: "confirmed" as const, start: "2026-10-19T12:00:00Z", end: "2026-10-19T13:00:00Z", graceMin: 15, money: money() };
    expect(ownerActions(b, start - 60 * 60000)).toEqual(["cancel", "move"]);
    expect(ownerActions(b, start - 30 * 60000)).toEqual(["check_in", "cancel", "move"]);
    expect(ownerActions(b, start + 20 * 60000)).toEqual(["check_in", "no_show"]);
    expect(ownerActions({ ...b, status: "checked_in" }, start + 20 * 60000)).toEqual(["extend", "collect"]);
    expect(ownerActions({ ...b, status: "checked_in", money: money(0, "not_due") }, start + 70 * 60000)).toEqual([]);
    expect(ownerActions({ ...b, status: "completed", money: money(150000, "collected") }, start + 70 * 60000)).toEqual([]);
  });
});

describe("timelineWindow", () => {
  it("keeps 06:00–23:00 and widens on the half-hour for blocks outside it that day", () => {
    expect(timelineWindow([], "2026-10-18")).toEqual({ open: 360, close: 1380 });
    // 00:00–01:00 and 23:00–00:30 Dhaka on 18 Oct (the second ends past midnight: clipped to the day).
    const late = [
      { start: "2026-10-17T18:00:00Z", end: "2026-10-17T19:00:00Z" },
      { start: "2026-10-18T17:00:00Z", end: "2026-10-18T18:30:00Z" },
    ];
    expect(timelineWindow(late, "2026-10-18")).toEqual({ open: 0, close: 1440 });
    expect(timelineWindow([{ start: "2026-10-19T01:00:00Z", end: "2026-10-19T02:00:00Z" }], "2026-10-18")).toEqual({ open: 360, close: 1380 });
    expect(blockColumns(late[0].start, late[0].end, "2026-10-18", 0, 1440)).toEqual({ from: 1, span: 2 });
  });
});
