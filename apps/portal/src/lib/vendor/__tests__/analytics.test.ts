import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import bn from "../../../../messages/bn.json";
import { analyticsHref, businessOptions, businessQuery, dayBars, hourBars, lineSeries, pairSeries, pickBusiness } from "../analytics";
import { canExportRegistrations, registrationsCsvName } from "../tournaments";

const org = (id: string, over: Partial<{ name: string; kind: string; status: string }> = {}) => ({ id, name: `Org ${id}`, kind: "sports", status: "verified", ...over });

describe("businessOptions, the analytics business switcher (Round B2)", () => {
  it("venue, shop and gym for active roles in sidebar order, then each sports organisation", () => {
    const got = businessOptions(["shop_owner", "ground_owner", "organiser"], [org("o1"), org("o2", { name: "Dhaka League" })]);
    expect(got.map((b) => b.key)).toEqual(["venue", "shop", "organiser:o1", "organiser:o2"]);
    expect(got[3]).toEqual({ key: "organiser:o2", role: "organiser", orgId: "o2", name: "Dhaka League" });
    expect(got[0]).toEqual({ key: "venue", role: "ground_owner", orgId: null, name: null });
  });

  it("only sports organisations whose console is open (verified or suspended); esports ones never", () => {
    const got = businessOptions([], [org("a"), org("b", { status: "suspended" }), org("c", { status: "pending_review" }), org("d", { kind: "esports" }), org("e", { status: "rejected" })]);
    expect(got.map((b) => b.orgId)).toEqual(["a", "b"]);
  });

  it("nothing for someone with no business", () => {
    expect(businessOptions([], [])).toEqual([]);
  });
});

describe("pickBusiness and the URL", () => {
  const options = businessOptions(["ground_owner", "shop_owner", "gym_owner"], [org("o1"), org("o2")]);

  it("follows ?business= (and &org= for an organisation)", () => {
    expect(pickBusiness(options, { business: "gym", org: "" }, "all")?.key).toBe("gym");
    expect(pickBusiness(options, { business: "organiser", org: "o2" }, "all")?.key).toBe("organiser:o2");
    // An organisation without &org= opens the first one.
    expect(pickBusiness(options, { business: "organiser", org: "" }, "all")?.key).toBe("organiser:o1");
  });

  it("a business not held (or an organisation not theirs) falls back to the panel's business, then the first", () => {
    const venueOnly = businessOptions(["ground_owner"], []);
    expect(pickBusiness(venueOnly, { business: "shop", org: "" }, "all")?.key).toBe("venue");
    expect(pickBusiness(options, { business: "organiser", org: "zzz" }, "shop_owner")?.key).toBe("shop");
    expect(pickBusiness(options, { business: "", org: "" }, "gym_owner")?.key).toBe("gym");
    expect(pickBusiness(options, { business: "", org: "" }, "organiser")?.key).toBe("organiser:o1");
    expect(pickBusiness(options, { business: "", org: "" }, "all")?.key).toBe("venue");
    expect(pickBusiness([], { business: "shop", org: "" }, "all")).toBeNull();
  });

  it("writes the URL parameters back, clearing org for everything but an organisation", () => {
    expect(businessQuery({ role: "shop_owner", orgId: null })).toEqual({ business: "shop", org: null });
    expect(businessQuery({ role: "organiser", orgId: "o2" })).toEqual({ business: "organiser", org: "o2" });
    expect(analyticsHref("gym_owner")).toBe("/vendor/analytics?business=gym");
    expect(analyticsHref("organiser", "o1")).toBe("/vendor/analytics?business=organiser&org=o1");
    expect(analyticsHref("ground_owner", "ignored")).toBe("/vendor/analytics?business=venue");
  });
});

describe("chart series", () => {
  const points = [
    { key: "2026-09-28", from: "2026-09-28", value: 1000, lastYear: 800 },
    { key: "2026-10-05", from: "2026-10-05", value: 1500, lastYear: 0 },
  ];

  it("a line with last year as the second series, left out when last year is empty (FR-05)", () => {
    expect(lineSeries({ points, lastYearShown: true })).toEqual({ points: [{ key: "2026-09-28", value: 1000 }, { key: "2026-10-05", value: 1500 }], compare: [800, 0] });
    expect(lineSeries({ points, lastYearShown: false }).compare).toBeNull();
    expect(lineSeries({ points: [], lastYearShown: false })).toEqual({ points: [], compare: null });
  });

  it("registered and approved as one line and its partner", () => {
    const rows = [
      { key: "w1", from: "w1", registered: 4, approved: 1 },
      { key: "w2", from: "w2", registered: 0, approved: 3 },
    ];
    expect(pairSeries(rows, "registered", "approved")).toEqual({ points: [{ key: "w1", value: 4 }, { key: "w2", value: 0 }], compare: [1, 3] });
    expect(pairSeries([], "registered", "approved")).toEqual({ points: [], compare: null });
  });

  it("busiest hours as all 24 hours of the day, missing hours at 0, a tick every six hours", () => {
    const bars = hourBars([
      { hour: 18, value: 12 },
      { hour: 6, value: 4 },
    ]);
    expect(bars).toHaveLength(24);
    expect(bars[18]).toEqual({ label: "6 pm", value: 12, tick: "6 pm" });
    expect(bars[6].value).toBe(4);
    expect(bars[7]).toEqual({ label: "7 am", value: 0, tick: "" });
    expect(bars.filter((b) => b.tick).map((b) => b.tick)).toEqual(["12 am", "6 am", "12 pm", "6 pm"]);
    expect(hourBars([], "bn")[18].label).not.toBe("6 pm");
  });

  it("days: a label under each of up to ten bars; a month's days get a tick every fifth bar and no figures", () => {
    const week = Array.from({ length: 7 }, (_, i) => ({ day: `2026-10-${String(12 + i).padStart(2, "0")}`, value: i }));
    const w = dayBars(week);
    expect(w.values).toBe(true);
    expect(w.bars[0]).toEqual({ label: "Mon 12", value: 0 });
    const month = Array.from({ length: 31 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, value: 1 }));
    const m = dayBars(month);
    expect(m.values).toBe(false);
    expect(m.bars.filter((b) => b.tick).map((b) => b.tick)).toEqual(["1", "6", "11", "16", "21", "26", "31"]);
    expect(new Set(m.bars.map((b) => b.label)).size).toBe(31);
  });
});

describe("registrations CSV (Round B2)", () => {
  it("owners and admins of the organisation only", () => {
    expect(canExportRegistrations("owner")).toBe(true);
    expect(canExportRegistrations("admin")).toBe(true);
    expect(canExportRegistrations("staff")).toBe(false);
    expect(canExportRegistrations(null)).toBe(false);
    expect(canExportRegistrations(undefined)).toBe(false);
  });

  it("a file name when the server gives none", () => {
    expect(registrationsCsvName("0b5c2a1e-1111-2222-3333-444455556666", false)).toBe("registrations-0b5c2a1e.csv");
    expect(registrationsCsvName("0b5c2a1e-1111-2222-3333-444455556666", true)).toBe("registrations-squads-0b5c2a1e.csv");
  });
});

describe("Round B2 words exist in both languages", () => {
  const at = (tree: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), tree);
  const keys = [
    "dashboard.business.ground_owner",
    "dashboard.business.shop_owner",
    "dashboard.business.gym_owner",
    "dashboard.business.organiser",
    "dashboard.actions.registrations_waiting",
    "dashboard.actions.registrations_unpaid",
    "dashboard.passKind.day",
    "dashboard.passKind.month",
    "dashboard.passKind.quarter",
    "dashboard.comingLater.conversion",
    "dashboard.comingLater.shopperFunnel",
    "dashboard.csv.limit",
    "dashboard.csv.tooLarge",
    "sportsConsole.export.withSquads",
  ];
  it.each(keys)("%s", (k) => {
    expect(typeof at(en, k)).toBe("string");
    expect(typeof at(bn, k)).toBe("string");
  });
});
