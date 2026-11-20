import { describe, expect, it } from "vitest";
import {
  billingBanner,
  churnPct,
  exportQuery,
  feeKind,
  fillVisitDays,
  invoicePayable,
  lineText,
  linkChannels,
  linkStatus,
  monthParam,
  offerLink,
  onlineFeesFix,
  openLinkOf,
  payLinkView,
  payPath,
  reasonsByCount,
  refundState,
  remindersOffAfter,
} from "../gym-money";

const NOW = Date.parse("2026-10-26T06:00:00Z");
const later = "2026-10-27T06:00:00Z";
const earlier = "2026-10-25T06:00:00Z";

describe("pay URLs and payment links (M24-FR-40, FR-41)", () => {
  it("opens the API's pay URL on this site, leaves other URLs alone", () => {
    expect(payPath("https://gym.kriraghor.com/pay/7c1e")).toBe("/pay/7c1e");
    expect(payPath("http://localhost:3003/pay/abc")).toBe("/pay/abc");
    expect(payPath("https://kriraghor.com/en/pay/abc")).toBe("https://kriraghor.com/en/pay/abc");
    expect(payPath("https://sandbox.sslcommerz.com/x")).toBe("https://sandbox.sslcommerz.com/x");
  });

  it("builds the channels from the toggles; none means the QR only", () => {
    expect(linkChannels(true, true)).toEqual(["in_app", "email"]);
    expect(linkChannels(false, true)).toEqual(["email"]);
    expect(linkChannels(false, false, true)).toEqual(["sms"]);
    expect(linkChannels(true, true, true)).toEqual(["in_app", "email", "sms"]);
    expect(linkChannels(true, false)).toEqual(["in_app"]);
    expect(linkChannels(false, false)).toEqual([]);
  });

  it("an open link past its expiry reads expired; the open one is found", () => {
    expect(linkStatus({ status: "open", expiresAt: later }, NOW)).toBe("open");
    expect(linkStatus({ status: "open", expiresAt: earlier }, NOW)).toBe("expired");
    expect(linkStatus({ status: "paid", expiresAt: earlier }, NOW)).toBe("paid");
    const links = [
      { id: "a", status: "open" as const, expiresAt: earlier },
      { id: "b", status: "cancelled" as const, expiresAt: later },
      { id: "c", status: "open" as const, expiresAt: later },
    ];
    expect(openLinkOf(links, NOW)?.id).toBe("c");
    expect(openLinkOf(links.slice(0, 2), NOW)).toBeNull();
  });

  it("GYM_ONLINE_FEES_UNAVAILABLE reasons send the owner to the right fix", () => {
    expect(onlineFeesFix("role")).toEqual({ key: "role", href: "/go/web/account/business?as=gym" });
    expect(onlineFeesFix("tier")).toEqual({ key: "tier", href: "/manage/billing" });
    expect(onlineFeesFix("restricted")).toEqual({ key: "restricted", href: "/manage/billing" });
    expect(onlineFeesFix(undefined).key).toBe("role");
  });

  it("the public link page: pay, paid, expired, cancelled, or not online", () => {
    const s = (status: "open" | "paid" | "expired" | "cancelled", expiresAt = later, onlineFees = true) => ({ link: { id: "l", status, amountPoisha: 150000, expiresAt }, onlineFees });
    expect(payLinkView(s("open"), NOW)).toBe("pay");
    expect(payLinkView(s("open", earlier), NOW)).toBe("expired");
    expect(payLinkView(s("expired"), NOW)).toBe("expired");
    expect(payLinkView(s("paid", earlier), NOW)).toBe("paid");
    expect(payLinkView(s("cancelled"), NOW)).toBe("cancelled");
    expect(payLinkView(s("open", later, false), NOW)).toBe("offline");
  });

  it("offers the link tick only when the API says the viewer can link", () => {
    expect(offerLink(null)).toBe(false);
    expect(offerLink({ phoneMatches: true, linked: false, canLink: true })).toBe(true);
    expect(offerLink({ phoneMatches: false, linked: false, canLink: false })).toBe(false);
    expect(offerLink({ phoneMatches: true, linked: true, canLink: false })).toBe(false);
  });
});

describe("online refund from the hold (M24-FR-44)", () => {
  const online = { amountPoisha: 150000, method: "online" as const, reversedById: null, reversesId: null };
  it("refundable before release, up to what is not yet refunded", () => {
    expect(refundState(online, { releaseAt: later, releasedAt: null, refundedPoisha: 0 }, NOW)).toEqual({ can: true, refundable: 150000, until: later });
    expect(refundState(online, { releaseAt: later, releasedAt: null, refundedPoisha: 50000 }, NOW)).toEqual({ can: true, refundable: 100000, until: later });
    expect(refundState(online, null, NOW)).toEqual({ can: true, refundable: 150000, until: null });
  });
  it("closed after release, when reversed, refunded, or not an online payment", () => {
    expect(refundState(online, { releaseAt: earlier, releasedAt: null, refundedPoisha: 0 }, NOW)).toEqual({ can: false, why: "released" });
    expect(refundState(online, { releaseAt: null, releasedAt: earlier, refundedPoisha: 0 }, NOW)).toEqual({ can: false, why: "released" });
    expect(refundState({ ...online, reversedById: "r" }, null, NOW)).toEqual({ can: false, why: "reversed" });
    expect(refundState(online, { releaseAt: later, releasedAt: null, refundedPoisha: 150000 }, NOW)).toEqual({ can: false, why: "refunded" });
    expect(refundState({ ...online, method: "cash" }, null, NOW)).toEqual({ can: false, why: "notOnline" });
    expect(refundState({ ...online, amountPoisha: -150000, reversesId: "p" }, null, NOW)).toEqual({ can: false, why: "notOnline" });
  });
});

describe("reports (M24-FR-71)", () => {
  it("month in the URL: a real month up to this one, else this month", () => {
    expect(monthParam("2026-09", "2026-10-26")).toBe("2026-09");
    expect(monthParam("2026-10", "2026-10-26")).toBe("2026-10");
    expect(monthParam("2026-11", "2026-10-26")).toBe("2026-10");
    expect(monthParam("2026-13", "2026-10-26")).toBe("2026-10");
    expect(monthParam("x", "2026-10-26")).toBe("2026-10");
    expect(monthParam(null, "2026-10-26")).toBe("2026-10");
    expect(monthParam("2019-12", "2026-10-26")).toBe("2026-10");
  });
  it("visits for every day of the period, zero where nobody came (dashboards)", () => {
    const d = fillVisitDays([{ date: "2026-10-30", visits: 3 }, { date: "2026-11-01", visits: 4 }], "2026-10-30", "2026-11-02");
    expect(d).toEqual([
      { date: "2026-10-30", visits: 3 },
      { date: "2026-10-31", visits: 0 },
      { date: "2026-11-01", visits: 4 },
      { date: "2026-11-02", visits: 0 },
    ]);
    expect(fillVisitDays([], "2026-11-03", "2026-11-02")).toEqual([]);
  });
  it("churn as a percent; reasons largest first without zeros", () => {
    expect(churnPct(0.0423)).toBe(4.2);
    expect(churnPct(0)).toBe(0);
    expect(churnPct(null)).toBeNull();
    expect(reasonsByCount({ price: 2, moved: 0, injury: 5, other: 2 })).toEqual([
      ["injury", 5],
      ["other", 2],
      ["price", 2],
    ]);
  });
  it("export query for a month or a range", () => {
    expect(exportQuery("payments", { month: "2026-09" })).toEqual({ dataset: "payments", month: "2026-09" });
    expect(exportQuery("members", { from: "2026-11-14", to: "2026-11-20" })).toEqual({ dataset: "members", from: "2026-11-14", to: "2026-11-20" });
  });
});

describe("reminders (M24-FR-55)", () => {
  it("switching a kind keeps the others as they are", () => {
    const kinds = [
      { kind: "renewal_due" as const, on: true },
      { kind: "ends_today" as const, on: false },
      { kind: "overdue" as const, on: true },
    ];
    expect(remindersOffAfter(kinds, "overdue", false)).toEqual(["ends_today", "overdue"]);
    expect(remindersOffAfter(kinds, "ends_today", true)).toEqual([]);
    expect(remindersOffAfter(kinds, "renewal_due", true)).toEqual(["ends_today"]);
  });
});

describe("billing (M24-FR-84 to FR-90)", () => {
  it("restricted beats past due; active shows no banner", () => {
    expect(billingBanner({ status: "restricted", restrictOn: null })).toEqual({ kind: "restricted" });
    expect(billingBanner({ status: "past_due", restrictOn: "2026-11-20" })).toEqual({ kind: "pastDue", restrictOn: "2026-11-20" });
    expect(billingBanner({ status: "active", restrictOn: null })).toBeNull();
    expect(billingBanner({ status: "closed", restrictOn: null })).toBeNull();
  });
  it("fees: standard, special until a date, or special open-ended", () => {
    expect(feeKind({ source: "setting", validTo: null })).toBe("standard");
    expect(feeKind({ source: "owner_override", validTo: "2026-12-31T18:00:00Z" })).toBe("specialUntil");
    expect(feeKind({ source: "gym_override", validTo: null })).toBe("special");
  });
  it("issued and overdue invoices can be paid; paid and void cannot", () => {
    expect(invoicePayable({ status: "issued" })).toBe(true);
    expect(invoicePayable({ status: "overdue" })).toBe(true);
    expect(invoicePayable({ status: "paid" })).toBe(false);
    expect(invoicePayable({ status: "void" })).toBe(false);
  });
  it("invoice lines in the page's language, falling back to the other", () => {
    expect(lineText({ descriptionEn: "Basic plan", descriptionBn: "বেসিক প্ল্যান" }, "bn")).toBe("বেসিক প্ল্যান");
    expect(lineText({ descriptionEn: "Basic plan", descriptionBn: "বেসিক প্ল্যান" }, "en")).toBe("Basic plan");
    expect(lineText({ descriptionEn: "Basic plan", descriptionBn: "" }, "bn")).toBe("Basic plan");
  });
});
