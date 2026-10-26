import { describe, expect, it } from "vitest";
import { cleanCode, copyDayToAll, gymActions, hoursProblems, scanInput, windowsOf, type Hours } from "../manage";

const w = (dow: number, openTime: string, closeTime: string, womenOnly = false) => ({ dow, openTime, closeTime, womenOnly });

describe("managing a gym (M20, moved from the business panel to gym.kriraghor.com/manage)", () => {
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

  it("tells a scanned QR token from a typed backup code", () => {
    expect(scanInput(" v1.0b2c.ab12.0123456789abcdef ")).toEqual({ token: "v1.0b2c.ab12.0123456789abcdef" });
    expect(scanInput("k7m-2pq")).toEqual({ code: "K7M2PQ" });
    expect(cleanCode(" ab 12-cd ")).toBe("AB12CD");
  });
});
