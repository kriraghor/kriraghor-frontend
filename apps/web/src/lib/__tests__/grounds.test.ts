import { describe, expect, it } from "vitest";
import { filtersFromParams, hourLabel, hoursLines, paramsFromFilters } from "../grounds";
import { missingFields } from "../kyc";

describe("grounds helpers (M09)", () => {
  it("round-trips filters through the URL", () => {
    const f = { sport: "football", areaId: "a1", surface: ["artificial_turf", "grass"], facilities: ["floodlights"], indoor: false, sort: "newest" as const };
    const qs = paramsFromFilters(f);
    expect(qs).toBe("?sport=football&area=a1&surface=artificial_turf%2Cgrass&facilities=floodlights&indoor=false&sort=newest");
    expect(filtersFromParams(new URLSearchParams(qs.slice(1)))).toEqual(f);
    expect(paramsFromFilters({})).toBe("");
    expect(filtersFromParams(new URLSearchParams("sort=bogus&indoor=maybe"))).toEqual({ sport: undefined, areaId: undefined, surface: undefined, facilities: undefined, indoor: undefined, sort: undefined });
  });

  it("labels hours and groups opening hours, Saturday first", () => {
    expect([0, 6, 12, 17].map(hourLabel)).toEqual(["12am", "6am", "12pm", "5pm"]);
    const open = (dow: number) => ({ dow, isClosed: false, openTime: "06:00", closeTime: "23:00" });
    const hours = [0, 1, 2, 3, 4, 6].map(open).concat({ dow: 5, isClosed: true, openTime: null, closeTime: null } as never);
    expect(hoursLines(hours, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "closed")).toEqual(["Sat–Thu: 06:00–23:00", "Fri: closed"]);
  });

  it("lists required business fields that are empty", () => {
    const fields = [{ key: "number", required: true }, { key: "expiresOn", required: true }, { key: "kind", required: false }];
    expect(missingFields(fields, { number: "TL-1", expiresOn: " " })).toEqual(["expiresOn"]);
    expect(missingFields(fields, { number: "TL-1", expiresOn: "2027-01-01" })).toEqual([]);
  });
});
