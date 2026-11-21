import { describe, expect, it } from "vitest";
import * as shared from "@kriraghor/ui/csv";
import { DEFAULT_PERIOD, PERIODS, asOfLabel, bucketLabel, bucketLabels, checklist, compactTaka, csvErrorKey, csvFilename, dayLabel, deskHref, dhakaToday, hourLabel, hourRange, mergeActions, pct, saveCsv } from "../dashboard";

describe("dashboard helpers (M19)", () => {
  it("taka in lakh and crore from ৳1 lakh up (FR-07)", () => {
    expect(compactTaka(43_000_000)).toBe("৳4.3 lakh");
    expect(compactTaka(10_000_000)).toBe("৳1 lakh");
    expect(compactTaka(2_500_000_000)).toBe("৳2.5 crore");
    expect(compactTaka(200000)).toBe("৳2,000");
    expect(compactTaka(43_000_000, "bn")).toBe("৳৪.৩ লাখ");
    expect(compactTaka(null)).toBe("–");
  });

  it("rates, buckets and hours", () => {
    expect(pct(0.382)).toBe("38%");
    expect(pct(0.0625)).toBe("6.3%");
    expect(pct(0.05)).toBe("5%");
    expect(pct(null)).toBe("–");
    expect(pct(0.5, "bn")).toBe("৫০%");
    expect(bucketLabel("2026-10-12")).toBe("12 Oct");
    expect(bucketLabel("2026-10")).toBe("Oct 26");
    expect(hourLabel(18)).toBe("6 pm");
  });
});

describe("deskHref: old desk paths to the current ones", () => {
  it("grounds became venues, tournaments became events", () => {
    expect(deskHref("/vendor/grounds")).toBe("/vendor/venues");
    expect(deskHref("/vendor/grounds/abc/pricing")).toBe("/vendor/venues/abc/pricing");
    expect(deskHref("/vendor/grounds?status=draft")).toBe("/vendor/venues?status=draft");
    expect(deskHref("/vendor/tournaments")).toBe("/vendor/events");
    expect(deskHref("/vendor/tournaments/org1/t/t9")).toBe("/vendor/events/org1/e/t9");
  });

  it("esports left the business panel (21 Oct 2026): its links land on events", () => {
    expect(deskHref("/vendor/esports")).toBe("/vendor/events");
    expect(deskHref("/vendor/esports/org1/billing?x=1")).toBe("/vendor/events");
  });

  it("leaves current and lookalike paths alone", () => {
    expect(deskHref("/vendor/inventory?status=low")).toBe("/vendor/inventory?status=low");
    expect(deskHref("/vendor/groundsman")).toBe("/vendor/groundsman");
    expect(deskHref("/admin/moderation")).toBe("/admin/moderation");
  });
});

describe("mergeActions: one Needs your action list across businesses (FR-11)", () => {
  const a = (key: string, severity: "high" | "normal" | "low", dueAt: string | null, href = `/vendor/${key}`) => ({ key, count: 1, severity, dueAt, href });

  it("sorts by severity, then the earliest due time, with no due time last", () => {
    const got = mergeActions([
      { role: "ground_owner", items: [a("balance_due", "normal", null), a("check_in_due", "high", "2026-10-21T12:00:00Z")] },
      { role: "shop_owner", items: [a("orders_to_ship", "high", "2026-10-21T09:00:00Z"), a("shop_changes_requested", "high", null), a("stock_low", "normal", "2026-10-22T00:00:00Z")] },
      { role: "gym_owner", items: [a("gym_changes_requested", "low", null)] },
    ]);
    expect(got.map((x) => x.key)).toEqual(["orders_to_ship", "check_in_due", "shop_changes_requested", "stock_low", "balance_due", "gym_changes_requested"]);
    expect(got[0].role).toBe("shop_owner");
  });

  it("maps old hrefs and keeps an empty list empty", () => {
    expect(mergeActions([{ role: "ground_owner", items: [a("ground_draft", "normal", null, "/vendor/grounds")] }])[0].href).toBe("/vendor/venues");
    expect(mergeActions([])).toEqual([]);
  });

  it("organisers' registrations join the list and land on the events console (Round B2)", () => {
    const got = mergeActions([
      { role: "shop_owner", items: [a("orders_to_ship", "normal", null)] },
      { role: "organiser", items: [a("registrations_waiting", "high", "2026-10-25T12:00:00Z", "/vendor/tournaments/org1"), a("registrations_unpaid", "normal", null, "/vendor/tournaments/org1")] },
    ]);
    expect(got.map((x) => [x.key, x.role, x.href])).toEqual([
      ["registrations_waiting", "organiser", "/vendor/events/org1"],
      ["orders_to_ship", "shop_owner", "/vendor/orders_to_ship"],
      ["registrations_unpaid", "organiser", "/vendor/events/org1"],
    ]);
  });
});

describe("CSV downloads (FR-22, Round B2)", () => {
  it("are the shared @kriraghor/ui/csv helpers (tested there)", () => {
    expect(csvFilename).toBe(shared.csvFilename);
    expect(csvErrorKey).toBe(shared.csvErrorKey);
    expect(saveCsv).toBe(shared.saveCsv);
  });
});

describe("checklist", () => {
  it("points at the first step not done", () => {
    expect(checklist([{ done: true }, { done: false }, { done: false }])).toMatchObject({ current: 1, complete: false, doneCount: 1 });
  });

  it("is complete when every step is done", () => {
    expect(checklist([{ done: true }, { done: true }])).toMatchObject({ current: -1, complete: true, doneCount: 2 });
    expect(checklist([])).toMatchObject({ current: -1, complete: true, doneCount: 0 });
  });
});

describe("dashboards round 2: the 30-day period and day buckets", () => {
  it("30 days leads the periods and is the default", () => {
    expect(PERIODS).toEqual(["30d", "7w", "qtr", "yr"]);
    expect(DEFAULT_PERIOD).toBe("30d");
  });

  it("a day bucket reads 21 Nov (Bangla digits in bn), with its weekday in full", () => {
    expect(bucketLabel("2026-11-21")).toBe("21 Nov");
    expect(dayLabel("2026-11-21")).toBe("Sat 21 Nov");
    const bnShort = bucketLabel("2026-11-21", "bn");
    expect(bnShort).toContain("২১");
    expect(bnShort).not.toMatch(/[0-9]/);
    expect(dayLabel("2026-11-21", "bn")).toContain("শনি");
  });

  it("30d labels are days with weekdays; weeks and months keep the short label", () => {
    expect(bucketLabels(["2026-11-20", "2026-11-21"], "30d")).toEqual({ labels: ["Fri 20 Nov", "Sat 21 Nov"], short: ["20 Nov", "21 Nov"] });
    expect(bucketLabels(["2026-10-12"], "7w")).toEqual({ labels: ["12 Oct"], short: ["12 Oct"] });
    expect(bucketLabels(["2026-10"], "yr")).toEqual({ labels: ["Oct 26"], short: ["Oct 26"] });
    expect(bucketLabels([], "30d")).toEqual({ labels: [], short: [] });
  });

  it("Dhaka's today and the Updated time (Dhaka clock, Bangla digits in bn)", () => {
    // 20:30 UTC is already the next day in Dhaka (UTC+6).
    expect(dhakaToday(new Date("2026-11-20T20:30:00Z"))).toBe("2026-11-21");
    expect(dhakaToday(new Date("2026-11-21T05:00:00Z"))).toBe("2026-11-21");
    expect(asOfLabel("2026-11-21T04:42:00Z")).toBe("10:42");
    expect(asOfLabel("2026-11-21T04:42:00Z", "bn")).toBe("১০:৪২");
    expect(asOfLabel(null)).toBeNull();
    expect(asOfLabel("not a date")).toBeNull();
  });

  it("an hour as a range", () => {
    expect(hourRange(18)).toBe("6 pm – 7 pm");
    expect(hourRange(23)).toBe("11 pm – 12 am");
  });
});
