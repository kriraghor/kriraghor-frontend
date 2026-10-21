import { describe, expect, it } from "vitest";
import { bucketLabel, checklist, compactTaka, deskHref, hourLabel, mergeActions, pct } from "../dashboard";

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
