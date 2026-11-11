import { describe, expect, it } from "vitest";
import { cleanCode, copyDayToAll, gymActions, hoursProblems, isOneDay, listingSteps, onlinePackageState, scanInput, specialDayBody, specialDayProblem, windowsOf, type Hours, type OwnerGym, type SpecialDayInput } from "../manage";

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
    expect(scanInput("86x1w8")).toEqual({ code: "86X1W8" });
    expect(cleanCode(" ab 12-cd ")).toBe("AB12CD");
  });
});

describe("what a gym lacks before review (M24-FR-24)", () => {
  const limits = { minPhotos: 3 } as OwnerGym["limits"];
  const pass = (kind: string, channel: string, price = 10000) => ({ kind, channel, price }) as OwnerGym["packages"][number];
  const gym = (packages: OwnerGym["packages"], photos = 3, hours = 1) => ({ limits, packages, photos: Array(photos).fill({}), hours: Array(hours).fill({}) }) as Pick<OwnerGym, "limits" | "packages" | "photos" | "hours">;

  it("needs one package sold online, of any kind", () => {
    expect(onlinePackageState(gym([]))).toBe("none");
    expect(onlinePackageState(gym([pass("month", "desk")]))).toBe("desk");
    expect(onlinePackageState(gym([pass("month", "desk"), pass("quarter", "desk")]))).toBe("desk");
    expect(onlinePackageState(gym([pass("month", "desk"), pass("year", "online")]))).toBe("online");
    expect(onlinePackageState(gym([pass("custom", "both")]))).toBe("online");
  });

  it("lists photos, hours and the online package, each done or not", () => {
    expect(listingSteps(gym([pass("month", "both")]))).toEqual([
      { key: "photos", done: true, have: 3, need: 3 },
      { key: "hours", done: true },
      { key: "onlinePackage", done: true, state: "online" },
    ]);
    expect(listingSteps(gym([pass("month", "desk")], 2, 0))).toEqual([
      { key: "photos", done: false, have: 2, need: 3 },
      { key: "hours", done: false },
      { key: "onlinePackage", done: false, state: "desk" },
    ]);
  });
});

describe("holidays and special hours (M20-FR-16, FR-17)", () => {
  const day = (x: Partial<SpecialDayInput> = {}): SpecialDayInput => ({ fromOn: "2026-12-16", toOn: "2026-12-16", kind: "closed", windows: [], title: "Victory Day", ...x });
  const at = { today: "2026-11-11", maxDays: 60 };
  const open = (openTime: string, closeTime: string) => ({ openTime, closeTime, womenOnly: false });

  it("lets a holiday and a day with changed hours through", () => {
    expect(specialDayProblem(day(), at)).toBeNull();
    expect(specialDayProblem(day({ fromOn: "2026-11-11", toOn: "2026-11-11" }), at)).toBeNull();
    expect(specialDayProblem(day({ kind: "hours", windows: [open("10:00", "16:00"), open("18:00", "22:00")] }), at)).toBeNull();
    // Exactly the longest allowed range.
    expect(specialDayProblem(day({ fromOn: "2026-12-01", toOn: "2027-01-29" }), at)).toBeNull();
  });

  it("names what stops it, in the order the form reads", () => {
    expect(specialDayProblem(day({ title: " E " }), at)).toBe("title");
    expect(specialDayProblem(day({ fromOn: "2026-12-20", toOn: "2026-12-18" }), at)).toBe("order");
    expect(specialDayProblem(day({ fromOn: "2026-11-10", toOn: "2026-11-12" }), at)).toBe("past");
    expect(specialDayProblem(day({ fromOn: "2026-12-01", toOn: "2027-01-30" }), at)).toBe("long");
    expect(specialDayProblem(day({ kind: "hours", windows: [] }), at)).toBe("hours");
    expect(specialDayProblem(day({ kind: "hours", windows: [open("16:00", "10:00")] }), at)).toBe("hours");
    expect(specialDayProblem(day({ kind: "hours", windows: [open("10:00", "16:00"), open("15:00", "20:00")] }), at)).toBe("hours");
  });

  it("sends a closed day without hours and a trimmed title", () => {
    expect(specialDayBody(day({ title: "  Eid-ul-Fitr ", windows: [open("10:00", "16:00")] }))).toEqual({ fromOn: "2026-12-16", toOn: "2026-12-16", kind: "closed", windows: [], title: "Eid-ul-Fitr" });
    expect(specialDayBody(day({ kind: "hours", windows: [open("10:00", "16:00")] })).windows).toEqual([open("10:00", "16:00")]);
  });

  it("tells one day from a range", () => {
    expect(isOneDay(day())).toBe(true);
    expect(isOneDay(day({ toOn: "2026-12-17" }))).toBe(false);
  });
});
