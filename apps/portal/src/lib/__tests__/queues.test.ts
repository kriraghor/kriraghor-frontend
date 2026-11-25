import { describe, expect, it } from "vitest";
import { ADMIN_HOME_FILTERS, STAFF_QUEUES, queueCards } from "../admin/queues";
import { DEFAULT_PERIOD, type ActionItem } from "../dashboard";

// M19-FR-29 and FR-30 (dashboards round 3): the admin home's queue cards and its period.
const item = (key: string, over: Partial<ActionItem> = {}): ActionItem => ({ key, count: 1, severity: "normal", dueAt: null, href: `/admin/${key}`, ...over });

describe("queueCards", () => {
  it("puts urgent queues first, then the page's order", () => {
    const cards = queueCards([item("results_to_enter"), item("reports_open"), item("payouts_to_approve", { severity: "high" }), item("disputes_escalated")]);
    expect(cards.map((c) => c.key)).toEqual(["payouts_to_approve", "disputes_escalated", "reports_open", "results_to_enter"]);
    expect(cards[0]).toMatchObject({ urgent: true, known: true, count: 1, href: "/admin/payouts_to_approve" });
  });

  it("keeps a queue the page does not know yet, last, with a general label", () => {
    const cards = queueCards([item("brand_new_queue"), item("risk_flags")]);
    expect(cards.map((c) => [c.key, c.known])).toEqual([
      ["risk_flags", true],
      ["brand_new_queue", false],
    ]);
  });

  it("orders equal queues by their earliest time limit, those without one last", () => {
    const cards = queueCards([item("disputes_to_review", { href: "/b" }), item("disputes_to_review", { href: "/a", dueAt: "2026-11-25T10:00:00.000Z" }), item("disputes_to_review", { href: "/c", dueAt: "2026-11-25T08:00:00.000Z" })]);
    expect(cards.map((c) => c.href)).toEqual(["/c", "/a", "/b"]);
  });

  it("is empty for an empty list, and knows every staff queue", () => {
    expect(queueCards([])).toEqual([]);
    expect(queueCards(STAFF_QUEUES.map((k) => item(k))).every((c) => c.known)).toBe(true);
  });
});

describe("ADMIN_HOME_FILTERS", () => {
  it("opens on 30 days and allows the dashboard periods only", () => {
    expect(ADMIN_HOME_FILTERS.period.default).toBe(DEFAULT_PERIOD);
    expect(DEFAULT_PERIOD).toBe("30d");
    expect(ADMIN_HOME_FILTERS.period.allowed).toEqual(["30d", "7w", "qtr", "yr"]);
  });

  it("keeps the review figures' scope in ?reviews=: me by default, or team (M19-FR-33)", () => {
    expect(ADMIN_HOME_FILTERS.reviews).toEqual({ default: "me", allowed: ["me", "team"] });
  });
});
