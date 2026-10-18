import { describe, expect, it } from "vitest";
import { heldOf, outOfLimits } from "../admin/gym";
import { cleanCode, copyDayToAll, gymActions, hoursProblems, packagesBody, scanInput, windowsOf, type Hours } from "../vendor/gym";

const w = (dow: number, openTime: string, closeTime: string, womenOnly = false) => ({ dow, openTime, closeTime, womenOnly });

describe("vendor gym desk (M20)", () => {
  it("offers the owner what the gym's state allows", () => {
    expect(gymActions("draft", null)).toEqual(["edit", "submit"]);
    expect(gymActions("changes_requested", null)).toEqual(["edit", "submit"]);
    expect(gymActions("pending_review", null)).toEqual([]);
    expect(gymActions("live", null)).toEqual(["edit", "pause"]);
    expect(gymActions("live", "draft")).toEqual(["edit", "submit_edit", "pause"]);
    expect(gymActions("live", "pending_review")).toEqual(["pause"]);
    expect(gymActions("paused", "changes_requested")).toEqual(["edit", "submit_edit", "resume"]);
    expect(gymActions("suspended", null)).toEqual([]);
    expect(gymActions("rejected", null)).toEqual([]);
  });

  it("edits the week: windows in order, copy a day to all, flag bad and overlapping windows", () => {
    const hours: Hours = [w(1, "16:00", "22:00", true), w(1, "06:00", "10:00")];
    expect(windowsOf(hours, 1).map((x) => x.openTime)).toEqual(["06:00", "16:00"]);
    const all = copyDayToAll(hours, 1);
    expect(all).toHaveLength(14);
    expect(windowsOf(all, 5)).toEqual([w(5, "06:00", "10:00"), w(5, "16:00", "22:00", true)]);
    expect(hoursProblems(hours)).toEqual([]);
    expect(hoursProblems([w(0, "10:00", "09:00")])).toEqual(["0:0:order"]);
    expect(hoursProblems([w(3, "06:00", "12:00"), w(3, "11:00", "14:00")])).toEqual(["3:1:overlap"]);
    expect(hoursProblems([w(3, "06:00", "24:00")])).toEqual([]);
  });

  it("builds the packages body in poisha, day pass first and required", () => {
    const rows = [
      { kind: "quarter" as const, title: "Quarter", taka: "9000", on: true },
      { kind: "day" as const, title: " Day pass ", taka: "400", on: true },
      { kind: "month" as const, title: "Month", taka: "", on: false },
    ];
    expect(packagesBody(rows)).toEqual({ ok: true, packages: [{ kind: "day", title: "Day pass", price: 40000 }, { kind: "quarter", title: "Quarter", price: 900000 }] });
    expect(packagesBody([{ kind: "month", title: "Month", taka: "3000", on: true }])).toEqual({ ok: false, problem: "day_required" });
    expect(packagesBody([{ kind: "day", title: "Day", taka: "4.5", on: true }])).toEqual({ ok: false, problem: "bad_price" });
    expect(packagesBody([{ kind: "day", title: "Day", taka: "0", on: true }])).toEqual({ ok: false, problem: "bad_price" });
    expect(packagesBody([{ kind: "day", title: "D", taka: "400", on: true }])).toEqual({ ok: false, problem: "bad_title" });
  });

  it("tells a scanned QR token from a typed backup code", () => {
    expect(scanInput(" v1.0b2c.ab12.0123456789abcdef ")).toEqual({ token: "v1.0b2c.ab12.0123456789abcdef" });
    expect(scanInput("k7m-2pq")).toEqual({ code: "K7M2PQ" });
    expect(cleanCode(" ab 12-cd ")).toBe("AB12CD");
  });

  it("shows staff what a platform cancel would refund and flags a day price outside the limits", () => {
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 0, refunded: 0 } })).toBe(300000);
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 300000, refunded: 0 } })).toBe(0); // released is gross (the fee leaves the hold too)
    expect(outOfLimits(40000, { dayMin: 10000, dayMax: 300000 })).toBe(false);
    expect(outOfLimits(5000, { dayMin: 10000, dayMax: 300000 })).toBe(true);
    expect(outOfLimits(400000, { dayMin: 10000, dayMax: 300000 })).toBe(true);
  });
});
