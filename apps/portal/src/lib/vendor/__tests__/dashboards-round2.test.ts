import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import bn from "../../../../messages/bn.json";
import { readFilters } from "../../use-url-filters";
import { ANALYTICS_FILTERS, FEE_PARTS, HOME_FILTERS, MEASURES, busiestHours, comingLaterItems, feeSplit, pickGround, rankBy } from "../analytics";
import { buildSummary, changePct, combineTiles, previousOf, registrationsIn, sumSparks } from "../summary";

/** Dashboards round 2 (20 Nov 2026): the vendor panel on the chart kit. */

describe("the period, business and venue in the URL", () => {
  it("opens on 30 days, all businesses' default and all venues", () => {
    expect(readFilters(new URLSearchParams(""), ANALYTICS_FILTERS)).toEqual({ business: "", org: "", period: "30d", groundId: "" });
    expect(readFilters(new URLSearchParams(""), HOME_FILTERS)).toEqual({ period: "30d" });
  });

  it("keeps a known period and venue, and reads anything else as the default", () => {
    expect(readFilters(new URLSearchParams("period=qtr&business=venue&groundId=g1"), ANALYTICS_FILTERS)).toEqual({ business: "venue", org: "", period: "qtr", groundId: "g1" });
    expect(readFilters(new URLSearchParams("period=5y"), ANALYTICS_FILTERS).period).toBe("30d");
    expect(readFilters(new URLSearchParams("period=7w"), HOME_FILTERS).period).toBe("7w");
    expect(readFilters(new URLSearchParams("period=week"), HOME_FILTERS).period).toBe("30d");
  });

  it("filters by a venue only when it is one of the owner's", () => {
    const grounds = [{ id: "g1" }, { id: "g2" }];
    expect(pickGround("g2", grounds)).toBe("g2");
    expect(pickGround("zz", grounds)).toBe("");
    expect(pickGround("", grounds)).toBe("");
    expect(pickGround("g1", undefined)).toBe("");
  });
});

describe("sales by category and best sellers: units or value", () => {
  const rows = [
    { id: "a", name: "Boots", units: 3, value: 900_000 },
    { id: "b", name: "Balls", units: 10, value: 300_000 },
    { id: "c", name: "Bats", units: 3, value: 120_000 },
  ];
  const other = (r: { units: number; value: number }) => `${r.units}/${r.value}`;

  it("by units: most items first, ties by name, the value as the second figure", () => {
    const got = rankBy(rows, "units", (r) => r.name, (r) => r.id, other);
    expect(got.map((r) => [r.key, r.value])).toEqual([
      ["b", 10],
      ["c", 3],
      ["a", 3],
    ]);
    expect(got[0]).toEqual({ key: "b", label: "Balls", value: 10, secondary: "10/300000" });
  });

  it("by value: most money first", () => {
    expect(rankBy(rows, "value", (r) => r.name, (r) => r.id, other).map((r) => r.key)).toEqual(["a", "b", "c"]);
    expect(rankBy([], "value", () => "", () => "", other)).toEqual([]);
    expect(MEASURES).toEqual(["units", "value"]);
  });
});

describe("busiest hours (the API's top six)", () => {
  it("are ranked by time booked, ties by the earlier hour", () => {
    expect(
      busiestHours(
        [
          { hour: 20, hours: 4 },
          { hour: 18, hours: 9 },
          { hour: 7, hours: 4 },
        ],
        (h) => h.hours,
      ),
    ).toEqual([
      { hour: 18, value: 9 },
      { hour: 7, value: 4 },
      { hour: 20, value: 4 },
    ]);
  });
});

describe("entry fees by tournament: where the money is", () => {
  it("held, released, refunded and the Kriraghor fee add up to what was collected", () => {
    const s = feeSplit({ collected: 100_000, held: 40_000, released: 45_000, refunded: 10_000 });
    expect(s.parts).toEqual([
      { key: "held", value: 40_000 },
      { key: "released", value: 45_000 },
      { key: "refunded", value: 10_000 },
      { key: "fee", value: 5_000 },
    ]);
    expect(s.total).toBe(100_000);
    expect(s.parts.reduce((a, p) => a + p.value, 0)).toBe(100_000);
    expect(FEE_PARTS).toEqual(["held", "released", "refunded", "fee"]);
  });

  it("never draws a negative fee, and an empty tournament is empty", () => {
    const odd = feeSplit({ collected: 50_000, held: 30_000, released: 30_000, refunded: 0 });
    expect(odd.parts.find((p) => p.key === "fee")?.value).toBe(0);
    expect(odd.total).toBe(60_000);
    expect(feeSplit({ collected: 0, held: 0, released: 0, refunded: 0 }).total).toBe(0);
  });
});

describe("coming later on the shop dashboard", () => {
  it("shows only items with words, never a raw key", () => {
    const known = (k: string) => k === "conversion" || k === "shopperFunnel";
    expect(comingLaterItems(["conversion", "basketSize", "shopperFunnel"], known)).toEqual(["conversion", "shopperFunnel"]);
    expect(comingLaterItems(["basketSize"], known)).toEqual([]);
  });
});

// ---------------- the vendor home's summary strip

const tile = (value: number | null, delta: number | null = null, spark: (number | null)[] | null = null) => ({ value, delta, spark });

describe("summary strip: changes and sparks across organisations", () => {
  it("works back the previous figure from a value and its change", () => {
    expect(previousOf(150, 50)).toBe(100);
    expect(previousOf(80, -20)).toBe(100);
    expect(previousOf(70, null)).toBe(0); // the API's null: nothing before
    expect(previousOf(0, -100)).toBeNull(); // anything became nothing: not recoverable
  });

  it("rounds a change as the API does", () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(104, 100)).toBe(4);
    expect(changePct(1046, 1000)).toBe(4.6);
    expect(changePct(5, 0)).toBeNull();
  });

  it("adds sparks point by point", () => {
    expect(sumSparks([[1, null, 3], [2, 2], null])).toEqual([3, 2, 3]);
    expect(sumSparks([null, []])).toBeNull();
  });

  it("combines entry-fee tiles: the sum, its change from each previous figure, the sparks added", () => {
    // 150 (+50% from 100) and 80 (−20% from 100): 230 against 200 is +15%.
    expect(combineTiles([tile(150, 50, [1, 2]), tile(80, -20, [3, 4])])).toEqual({ value: 230, delta: 15, spark: [4, 6] });
    // One organisation: its own change as sent.
    expect(combineTiles([tile(150, 50)]).delta).toBe(50);
    // A −100% one cannot be undone, so no combined change.
    expect(combineTiles([tile(0, -100), tile(100, 0)]).delta).toBeNull();
    // Nothing before anywhere: no change.
    expect(combineTiles([tile(10, null), tile(20, null)]).delta).toBeNull();
  });

  it("counts registrations over 30 days, otherwise in the current bucket", () => {
    const rows = [{ registered: 2 }, { registered: 3 }, { registered: 4 }];
    expect(registrationsIn(rows, "30d")).toBe(9);
    expect(registrationsIn(rows, "7w")).toBe(4);
    expect(registrationsIn([], "qtr")).toBe(0);
  });
});

describe("buildSummary", () => {
  const venue = { tiles: { revenue: tile(500_000, 12, [100, 200]), bookings: tile(42) } };
  const shop = { tiles: { sales: tile(300_000, -5, [50, null]), orders: tile(18) } };
  const org = (fees: number, delta: number | null, regs: number[]) => ({ tiles: { entryFees: tile(fees, delta) }, charts: { registrationsOverTime: regs.map((registered) => ({ registered })) } });
  const payouts = { nextPayout: { date: "2026-11-25T00:00:00Z", projected: 380_000 }, paidThisMonth: 120_000, onHold: { amount: 0 } };

  it("a money tile per kind of business, in sidebar order, each with its own count; never one summed figure", () => {
    const s = buildSummary({ period: "30d", shop, venue, organisers: [org(100, 50, [1, 2]), org(80, -20, [3])], payouts, actions: { lines: 3, urgent: 1 } });
    expect(s.money.map((m) => m.key)).toEqual(["venue", "shop", "organiser"]);
    expect(s.money[0]).toEqual({ key: "venue", value: 500_000, delta: 12, spark: [100, 200], count: 42 });
    expect(s.money[1]).toEqual({ key: "shop", value: 300_000, delta: -5, spark: [50, 0], count: 18 });
    expect(s.money[2]).toMatchObject({ key: "organiser", value: 180, delta: 8, count: 6 });
    expect(s.money.some((m) => m.value === 500_000 + 300_000 + 180)).toBe(false);
    expect(s.payouts).toEqual({ projected: 380_000, date: "2026-11-25T00:00:00Z", paidThisMonth: 120_000, onHold: 0 });
    expect(s.todo).toEqual({ lines: 3, urgent: 1 });
  });

  it("only the businesses that loaded, and nothing for payouts or the to-do while unknown", () => {
    const s = buildSummary({ period: "7w", gym: { tiles: { passSales: tile(null), passesSold: tile(null) } } });
    expect(s.money).toEqual([{ key: "gym", value: 0, delta: null, spark: null, count: 0 }]);
    expect(s.payouts).toBeNull();
    expect(s.todo).toBeNull();
    expect(buildSummary({ period: "30d", organisers: [] }).money).toEqual([]);
  });
});

describe("round 2 words exist in both languages", () => {
  const at = (tree: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), tree);
  const keys = [
    "dashboard.periods.30d",
    "dashboard.vs.30d",
    ...["30d", "7w", "qtr", "yr"].map((p) => `dashboard.scope.${p}`),
    ...["bookingsByDay", "revenueByGround", "ordersByDay", "salesByCategory", "admissionsByDay", "salesByPackage", "bestSellersTitle", "last30", "busiestHoursTop", "feesByEventSub", "byDay", "byWeek", "byMonth"].map((k) => `dashboard.charts.${k}`),
    ...["label", ...MEASURES].map((k) => `dashboard.measure.${k}`),
    ...["tournament", "collected", ...FEE_PARTS].map((k) => `dashboard.fees.${k}`),
    "dashboard.ground.label",
    "dashboard.ground.all",
    "dashboard.ground.csvNote",
    "dashboard.retry",
    ...["title", "moneyHelp", "venue", "shop", "gym", "organiser", "venueCount", "shopCount", "gymCount", "organiserCount", "payout", "payoutHelp", "payoutOn", "paidThisMonth", "onHold", "todo", "todoHelp", "urgent", "allClear", "todoLink"].map((k) => `dashboard.summary.${k}`),
    "dashboard.legend.lastYear",
    "dashboard.legend.registered",
    "dashboard.legend.approved",
  ];
  it.each(keys)("%s", (k) => {
    const e = at(en, k);
    const b = at(bn, k);
    expect(typeof e).toBe("string");
    expect(typeof b).toBe("string");
    // Real Bangla, not the English copied over (labels with digits only are fine either way).
    if (/[a-z]{3}/i.test(String(e))) expect(b).not.toBe(e);
  });
});
