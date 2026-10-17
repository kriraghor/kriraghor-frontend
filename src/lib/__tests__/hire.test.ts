import { describe, expect, it } from "vitest";
import { busyByDay, dhakaDay, dhakaInstant, filtersFromParams, jobTone, limitKey, minutesLeft, nextDays, paramsFromFilters, poishaToTaka, profileTone, rateOf, requestTone, takaToPoisha, type RateCard } from "../hire";

describe("hire (M11)", () => {
  it("round-trips the directory filters through the URL (rating is the default sort)", () => {
    const f = filtersFromParams(new URLSearchParams("category=officials&exp=pro,national,bogus&unit=match&sort=rate&q=bcb"));
    expect(f).toEqual({ category: "officials", exp: ["pro", "national"], unit: "match", sort: "rate", q: "bcb" });
    expect(paramsFromFilters(f)).toBe("?category=officials&exp=pro%2Cnational&unit=match&q=bcb&sort=rate");
    expect(filtersFromParams(new URLSearchParams("unit=day&sort=rating"))).toEqual({});
    expect(paramsFromFilters({ sort: "rating" })).toBe("");
  });

  it("reads times on the Dhaka clock (UTC+6)", () => {
    expect(dhakaInstant("2026-10-22", "19:30")).toBe("2026-10-22T13:30:00.000Z");
    expect(dhakaInstant("2026-10-23", "02:00")).toBe("2026-10-22T20:00:00.000Z");
    expect(dhakaDay("2026-10-22T18:30:00.000Z")).toBe("2026-10-23");
    expect(nextDays(3, new Date("2026-10-22T19:00:00.000Z"))).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  it("puts a busy window on each Dhaka day it touches", () => {
    const night = { start: "2026-10-22T16:00:00.000Z", end: "2026-10-22T19:00:00.000Z" }; // 22:00 to 01:00 Dhaka
    const evening = { start: "2026-10-22T13:30:00.000Z", end: "2026-10-22T17:30:00.000Z" }; // 19:30 to 23:30
    const m = busyByDay([night, evening]);
    expect(m.get("2026-10-22")).toEqual([night, evening]);
    expect(m.get("2026-10-23")).toEqual([night]);
  });

  it("finds a rate by unit and format, and converts taka", () => {
    const card = { items: [{ unit: "match", format: "T20", rate: 350000 }, { unit: "hourly", format: null, rate: 60000 }] } as RateCard;
    expect(rateOf(card, "match", "T20")).toBe(350000);
    expect(rateOf(card, "hourly")).toBe(60000);
    expect(rateOf(card, "match", "OD")).toBeNull();
    expect(rateOf(null, "match")).toBeNull();
    expect(takaToPoisha("3,500")).toBe(350000);
    expect(takaToPoisha("1012.5")).toBe(101250);
    expect(takaToPoisha("12.345")).toBeNull();
    expect(takaToPoisha("")).toBeNull();
    expect(poishaToTaka(350000)).toBe("3500");
    expect(poishaToTaka(101250)).toBe("1012.50");
    expect(poishaToTaka(null)).toBe("");
    expect(limitKey("match", "T20")).toBe("match:T20");
    expect(limitKey("hourly")).toBe("hourly:");
  });

  it("tones requests, jobs and profiles", () => {
    expect(requestTone("confirmed")).toBe("ok");
    expect(requestTone("accepted_unpaid")).toBe("warn");
    expect(requestTone("lapsed")).toBe("muted");
    expect(jobTone("released")).toBe("ok");
    expect(jobTone("completed_marked")).toBe("warn");
    expect(jobTone("disputed")).toBe("error");
    expect(jobTone("refunded")).toBe("muted");
    expect(profileTone("live")).toBe("ok");
    expect(profileTone("pending_review")).toBe("warn");
    expect(profileTone("changes_requested")).toBe("error");
    expect(profileTone("removed")).toBe("muted");
  });

  it("counts the minutes left to pay or reply", () => {
    const now = Date.parse("2026-10-22T10:00:00.000Z");
    expect(minutesLeft("2026-10-22T12:00:00.000Z", now)).toBe(120);
    expect(minutesLeft("2026-10-22T10:00:30.000Z", now)).toBe(1);
    expect(minutesLeft("2026-10-22T09:00:00.000Z", now)).toBe(0);
    expect(minutesLeft(null, now)).toBe(0);
  });
});
