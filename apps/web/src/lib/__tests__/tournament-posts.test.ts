import { describe, expect, it } from "vitest";
import { dateRange, dayKey, daysUntil } from "../tournament-dates";
import { EMPTY_FORM, feedQuery, formOf, formProblems, poishaOf, takaOf, type PostForm, type PostPage } from "../tournament-posts";

const good: PostForm = { ...EMPTY_FORM, title: "Mirpur Futsal Cup", sport: "football", districtId: "d1", venueName: "Kick Off", startDate: "2026-11-20", registrationDeadline: "2026-11-15", organiserName: "Mirpur Club", description: "Sixteen teams over one weekend in Mirpur." };

describe("the feed's query (M26-FR-05)", () => {
  it("sends only what's set, newest by default", () => {
    expect(feedQuery({})).toEqual({ sort: "newest" });
    expect(feedQuery({ q: "  cup ", sport: "football", districtId: "d1", fee: "free", format: "league", gender: "women", open: "1", sort: "starts_soon" }, "20")).toEqual({
      q: "cup",
      sport: "football",
      districtId: "d1",
      fee: "free",
      format: "league",
      gender: "women",
      registrationOpen: "true",
      sort: "starts_soon",
      cursor: "20",
    });
  });
  it("cuts a long search to what the API takes, and drops an empty one", () => {
    expect(feedQuery({ q: "x".repeat(80) }).q).toHaveLength(60);
    expect(feedQuery({ q: "   " })).toEqual({ sort: "newest" });
  });
});

describe("the post form (M26-FR-03)", () => {
  it("is happy with a complete form", () => {
    expect(formProblems(good, "2026-11-03")).toEqual([]);
  });
  it("names each thing that's missing", () => {
    expect(formProblems(EMPTY_FORM, "2026-11-03")).toEqual(["title", "sport", "districtId", "venueName", "startDate", "registrationDeadline", "organiserName", "description"]);
  });
  it("checks the dates against each other and today", () => {
    expect(formProblems({ ...good, startDate: "2026-11-01", registrationDeadline: "2026-10-30" }, "2026-11-03")).toEqual(["startDate"]);
    expect(formProblems({ ...good, registrationDeadline: "2026-11-21" }, "2026-11-03")).toEqual(["registrationDeadline"]);
    expect(formProblems({ ...good, endDate: "2026-11-19" }, "2026-11-03")).toEqual(["endDate"]);
  });
  it("reads taka as poisha, and back", () => {
    expect(poishaOf("2000")).toBe(200000);
    expect(poishaOf("12.5")).toBe(1250);
    expect(poishaOf(" 0 ")).toBe(0);
    expect(poishaOf("")).toBeNull();
    expect(poishaOf("abc")).toBeNull();
    expect(poishaOf("-5")).toBeNull();
    expect(takaOf(200000)).toBe("2000");
    expect(takaOf(null)).toBe("");
  });
  it("puts a saved post back in the form", () => {
    const page = { title: "Cup", sport: { key: "football", en: "Football", bn: "ফুটবল" }, format: "league", district: { id: "d1", en: "", bn: "" }, area: null, venueName: "V", address: null, mapLink: null, startDate: "2026-11-20", endDate: null, registrationDeadline: "2026-11-15", entryFee: 0, prizePool: null, prizeDetails: null, teamLimit: null, playersPerTeam: null, gender: "open", ageGroup: null, skillLevel: null, organiserName: "O", description: "D", rules: null } as unknown as PostPage;
    expect(formOf(page)).toMatchObject({ sport: "football", districtId: "d1", areaId: null, format: "league" });
    expect(formOf({ ...page, district: null } as unknown as PostPage).districtId).toBe("");
  });
});

describe("dates", () => {
  it("reads as Dhaka dates", () => {
    expect(dayKey(Date.parse("2026-11-02T18:30:00Z"))).toBe("2026-11-03");
    expect(daysUntil("2026-11-05", "2026-11-03")).toBe(2);
    expect(daysUntil("2026-11-01", "2026-11-03")).toBe(-2);
  });
  it("writes one day or a range", () => {
    expect(dateRange("2026-11-20", null, "en")).toBe("20 Nov 2026");
    expect(dateRange("2026-11-20", "2026-11-20", "en")).toBe("20 Nov 2026");
    expect(dateRange("2026-11-20", "2026-11-22", "en")).toBe("20 – 22 Nov 2026");
    expect(dateRange("2026-11-30", "2026-12-02", "en")).toBe("30 Nov – 2 Dec 2026");
  });
});
