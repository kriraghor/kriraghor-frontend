import { describe, expect, it } from "vitest";
import { countdown, dhakaDateOf, filled, finderUrl, nextTab, podium, searchGroups, searchText, sectionUrl, SECTIONS } from "../home";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

const keys = (o: object, at = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${at}${k}.`) : [`${at}${k}`]));

describe("home", () => {
  it("reads the Dhaka date of an instant (UTC+6)", () => {
    expect(dhakaDateOf("2026-10-18T17:59:59Z")).toBe("2026-10-18");
    expect(dhakaDateOf("2026-10-18T18:00:00Z")).toBe("2026-10-19");
  });

  it("counts down to the start, with days when far away, and stops once started", () => {
    const start = "2026-10-19T12:00:00Z";
    expect(countdown(start, Date.parse("2026-10-19T10:17:51Z"))).toBe("01:42:09");
    expect(countdown(start, Date.parse("2026-10-17T08:50:00Z"))).toBe("2d 03:10");
    expect(countdown(start, Date.parse(start))).toBeNull();
    expect(countdown("not a date", 0)).toBeNull();
  });

  it("sends each section's search to its list page with the filter that page reads", () => {
    expect(sectionUrl("esports", { q: "squad", filter: "free_fire" })).toBe("/go/esports/events?q=squad&game=free_fire");
    expect(sectionUrl("esports")).toBe("/go/esports/events");
    expect(sectionUrl("gym", { q: "iron", filter: "a1" })).toBe("/go/gym/gyms?q=iron&areaId=a1");
    expect(sectionUrl("venues", { filter: "football" })).toBe("/venues?sport=football");
    expect(sectionUrl("shop", { q: "  whey protein " })).toBe("/shop?q=whey+protein");
    expect(sectionUrl("shop", { filter: "supplements" })).toBe("/shop?category=supplements");
    expect(sectionUrl("hire", { filter: "officials" })).toBe("/hiring?category=officials");
    expect(sectionUrl("events", { q: "cup", filter: "cricket" })).toBe("/events?q=cup&sport=cricket");
  });

  it("leaves out text too short for the APIs and caps long text", () => {
    expect(sectionUrl("shop", { q: "   " })).toBe("/shop");
    expect(sectionUrl("shop", { q: "a" })).toBe("/shop");
    expect(searchText(null)).toBe("");
    expect(searchText(undefined)).toBe("");
    expect(searchText(" ab ")).toBe("ab");
    expect(searchText("x".repeat(80))).toHaveLength(60);
  });

  it("builds a search group per section, or none for short text", () => {
    expect(searchGroups("a")).toEqual([]);
    expect(searchGroups(null)).toEqual([]);
    const groups = searchGroups(" iron ");
    expect(groups.map((g) => g.key)).toEqual([...SECTIONS]);
    expect(groups[1]).toEqual({ key: "gym", text: "iron", href: "/go/gym/gyms?q=iron" });
  });

  it("builds finder links with only the filters each page supports", () => {
    expect(finderUrl("tournaments", { game: "free_fire" })).toBe("/go/esports/events?game=free_fire");
    expect(finderUrl("tournaments", {})).toBe("/go/esports/events");
    expect(finderUrl("grounds", { sport: "football", areaId: "a1" })).toBe("/venues?sport=football&area=a1");
    expect(finderUrl("shop", { q: "  whey protein " })).toBe("/shop?q=whey+protein");
    expect(finderUrl("shop", { q: "   " })).toBe("/shop");
    expect(finderUrl("hire", { category: "officials", areaId: "a1" })).toBe("/hiring?category=officials&areaId=a1");
  });

  it("moves between finder tabs with the arrow keys, Home and End", () => {
    expect(nextTab(0, "ArrowRight", 4)).toBe(1);
    expect(nextTab(3, "ArrowRight", 4)).toBe(0);
    expect(nextTab(0, "ArrowLeft", 4)).toBe(3);
    expect(nextTab(2, "ArrowUp", 4)).toBe(1);
    expect(nextTab(2, "ArrowDown", 4)).toBe(3);
    expect(nextTab(2, "Home", 4)).toBe(0);
    expect(nextTab(1, "End", 4)).toBe(3);
    expect(nextTab(1, "Enter", 4)).toBeNull();
  });

  it("works out the share of places taken and the top three prizes", () => {
    expect(filled(3, 12)).toBe(0.25);
    expect(filled(20, 12)).toBe(1);
    expect(filled(1, 0)).toBe(0);
    const prize = (place: number) => ({ place, amount: { amount: place } });
    expect(podium([prize(4), prize(2), prize(1), prize(3)]).map((p) => p.place)).toEqual([1, 2, 3]);
    expect(podium(null)).toEqual([]);
  });

  it("has every word of the new pages in both languages", () => {
    for (const ns of ["home", "howItWorks", "about", "bizHome", "search", "footer"] as const) {
      expect(keys(bn[ns]).sort()).toEqual(keys(en[ns]).sort());
    }
    expect(bn.nav.business).toBeTruthy();
    expect(bn.nav.search).toBeTruthy();
  });
});
