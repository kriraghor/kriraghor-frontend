import { describe, expect, it } from "vitest";
import { addDays, dhakaToday, dowOf, openDates, passTone, subscriptionTone, weekOf, type Hours } from "../gym";
import { asOfRole, roleFromAs } from "../kyc";

const w = (dow: number, openTime: string, closeTime: string, womenOnly = false) => ({ dow, openTime, closeTime, womenOnly });

describe("gym (M20)", () => {
  it("reads today on the Dhaka calendar (UTC+6)", () => {
    expect(dhakaToday(new Date("2026-10-18T17:59:59Z"))).toBe("2026-10-18");
    expect(dhakaToday(new Date("2026-10-18T18:00:00Z"))).toBe("2026-10-19");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dowOf("2026-10-18")).toBe(0); // a Sunday
  });

  it("offers a day pass only on the days the gym opens", () => {
    const hours: Hours = [w(0, "06:00", "22:00"), w(2, "06:00", "10:00"), w(2, "16:00", "22:00", true)];
    expect(openDates(hours, "2026-10-18", 7)).toEqual(["2026-10-18", "2026-10-20"]);
    expect(openDates([], "2026-10-18", 7)).toEqual([]);
  });

  it("lists the week Saturday first with each day's windows in time order", () => {
    const week = weekOf([w(2, "16:00", "22:00", true), w(2, "06:00", "10:00"), w(6, "07:00", "21:00")]);
    expect(week.map((d) => d.dow)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(week[3].windows.map((x) => x.openTime)).toEqual(["06:00", "16:00"]);
    expect(week[1].windows).toEqual([]);
  });

  it("colours passes and subscriptions by state", () => {
    expect(passTone("active")).toBe("ok");
    expect(passTone("pending_payment")).toBe("warn");
    expect(passTone("redeemed")).toBe("muted");
    expect(subscriptionTone("active")).toBe("ok");
    expect(subscriptionTone("renewal_due")).toBe("warn");
    expect(subscriptionTone("grace")).toBe("warn");
    expect(subscriptionTone("lapsed")).toBe("error");
    expect(subscriptionTone("ended")).toBe("muted");
  });

  it("maps ?as=gym to the gym_owner role and back", () => {
    expect(roleFromAs("gym")).toBe("gym_owner");
    expect(asOfRole("gym_owner")).toBe("gym");
    expect(roleFromAs(null)).toBe("ground_owner");
  });
});
