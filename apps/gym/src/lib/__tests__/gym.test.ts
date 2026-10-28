import { describe, expect, it } from "vitest";
import { addDays, dhakaToday, distanceText, dowOf, gymListParams, openDates, passTone, subscriptionTone, weekOf, type Hours } from "../gym";

describe("the /gyms filters (M24 prompt 3)", () => {
  it("sorts nearest only with a position, and rounds the position", () => {
    expect(gymListParams({})).toEqual({ limit: 24, sort: "price" });
    expect(gymListParams({ sort: "nearest" })).toEqual({ limit: 24, sort: "price" });
    expect(gymListParams({ at: { lat: 23.780887, lng: 90.407249 }, radiusKm: 5 })).toEqual({ limit: 24, lat: 23.7809, lng: 90.4072, radiusKm: 5, sort: "nearest" });
    expect(gymListParams({ at: { lat: 23.78, lng: 90.4 }, sort: "rating" }).sort).toBe("rating");
    expect(gymListParams({ radiusKm: 5 })).not.toHaveProperty("radiusKm");
  });

  it("sends the area, facility, search and monthly price cap only when set", () => {
    expect(gymListParams({ areaId: "a1", facility: "f1", q: " iron ", priceMax: 250000, cursor: "24" })).toEqual({ limit: 24, areaId: "a1", facility: "f1", q: "iron", priceMax: 250000, sort: "price", cursor: "24" });
    expect(gymListParams({ q: "a", priceMax: 0 })).toEqual({ limit: 24, sort: "price" });
  });

  it("writes a distance in metres or kilometres", () => {
    expect(distanceText(null, "en")).toBeNull();
    expect(distanceText(4, "en")).toBe("10 m");
    expect(distanceText(846, "en")).toBe("850 m");
    expect(distanceText(2440, "en")).toBe("2.4 km");
    expect(distanceText(12600, "en")).toBe("13 km");
  });
});

const w = (dow: number, openTime: string, closeTime: string, womenOnly = false) => ({ dow, openTime, closeTime, womenOnly });

describe("gyms for members (M20, on gym.kriraghor.com)", () => {
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
});
