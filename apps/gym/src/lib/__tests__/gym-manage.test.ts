import { describe, expect, it } from "vitest";
import {
  countdown,
  deskAction,
  deskInput,
  draftOf,
  dueActions,
  duesQuery,
  featureLocked,
  importPreview,
  importTemplateCsv,
  IMPORT_HEADERS,
  membersListReady,
  membersQuery,
  membershipActions,
  minTierFor,
  monthGrid,
  packageRowsOf,
  packagesPayload,
  poishaToTakaText,
  qrRefreshIn,
  receiptLines,
  receiptPath,
  receiptState,
  reversible,
  secondsLeft,
  settingsPatch,
  shiftMonth,
  packageToSellOnline,
  starterRows,
  takaToPoisha,
  tiersInOrder,
  type GymSettings,
  type ImportRow,
  type PackageRow,
} from "../gym-manage";

describe("money typed at the counter (poisha, M24-FR-33)", () => {
  it("reads taka with commas and up to 2 decimals; refuses zero, negatives and junk", () => {
    expect(takaToPoisha("1,500")).toBe(150000);
    expect(takaToPoisha(" 250.5 ")).toBe(25050);
    expect(takaToPoisha("250.05")).toBe(25005);
    expect(takaToPoisha("0")).toBeNull();
    expect(takaToPoisha("0", { allowZero: true })).toBe(0);
    expect(takaToPoisha("-5")).toBeNull();
    expect(takaToPoisha("1.234")).toBeNull();
    expect(takaToPoisha("abc")).toBeNull();
    expect(takaToPoisha("")).toBeNull();
    expect(poishaToTakaText(150050)).toBe("1500.5");
    expect(poishaToTakaText(null)).toBe("");
  });
});

describe("the desk: one box, a member QR checks in, a pass QR admits (M24-FR-47, FR-50)", () => {
  it("tells a member token, a pass token and a search apart", () => {
    expect(deskInput(" v1.gm.0b2c7f0e-1111-4222-8333-944455556666.29871234.0123456789abcdef0123456789abcdef ")).toEqual({ kind: "member", token: "v1.gm.0b2c7f0e-1111-4222-8333-944455556666.29871234.0123456789abcdef0123456789abcdef" });
    expect(deskInput("v1.0b2c.ab12.0123456789abcdef")).toEqual({ kind: "pass", token: "v1.0b2c.ab12.0123456789abcdef" });
    expect(deskInput("PM-0012")).toEqual({ kind: "search", q: "PM-0012" });
    expect(deskInput("01712345678")).toEqual({ kind: "search", q: "01712345678" });
    expect(deskInput("   ")).toEqual({ kind: "empty" });
  });

  it("shows Check in on allow and warn, the owner's override on block, nothing for staff on block", () => {
    expect(deskAction({ decision: "allow", canOverride: false })).toBe("checkIn");
    expect(deskAction({ decision: "warn", canOverride: false })).toBe("checkInWarn");
    expect(deskAction({ decision: "block", canOverride: true })).toBe("override");
    expect(deskAction({ decision: "block", canOverride: false })).toBe("refused");
  });
});

describe("list filters in the URL → API queries", () => {
  it("maps each member view to its filter, with search, package and cursor", () => {
    expect(membersQuery({})).toEqual({});
    expect(membersQuery({ view: "active" })).toEqual({ status: "active" });
    expect(membersQuery({ view: "left", q: "  rahim " })).toEqual({ status: "left", q: "rahim" });
    expect(membersQuery({ view: "due" })).toEqual({ due: "true" });
    expect(membersQuery({ view: "overdue" })).toEqual({ overdue: "true" });
    expect(membersQuery({ view: "expiring" })).toEqual({ expiring: "true" });
    expect(membersQuery({ view: "unlinked", packageId: "p1", cursor: "c", limit: 25 })).toEqual({ linked: "false", packageId: "p1", cursor: "c", limit: 25 });
    expect(membersQuery({ view: "nonsense" })).toEqual({});
  });

  it("the not-seen view asks for the gym's own days and assumes none (M24-FR-23, FR-53)", () => {
    expect(membersQuery({ view: "notSeen", notSeenDays: 14 })).toEqual({ notSeen: 14 });
    expect(membersQuery({ view: "notSeen", notSeenDays: 3, q: "rahim" })).toEqual({ notSeen: 3, q: "rahim" });
    expect(membersQuery({ view: "notSeen" })).toEqual({});
    expect(membersQuery({ view: "notSeen", notSeenDays: 0 })).toEqual({});
    expect(membersQuery({ view: "active", notSeenDays: 14 })).toEqual({ status: "active" });
  });

  it("the list waits for those days on the not-seen view only (M24-FR-53)", () => {
    expect(membersListReady("notSeen", undefined)).toBe(false);
    expect(membersListReady("notSeen", 0)).toBe(false);
    expect(membersListReady("notSeen", 14)).toBe(true);
    expect(membersListReady("", undefined)).toBe(true);
    expect(membersListReady("active", undefined)).toBe(true);
    expect(membersListReady(undefined, undefined)).toBe(true);
  });

  it("maps each fee view to the dues filters (default unpaid and partial)", () => {
    expect(duesQuery("", "2026-10-26")).toEqual({});
    expect(duesQuery("overdue", "2026-10-26", "c1")).toEqual({ cursor: "c1", overdue: "true" });
    expect(duesQuery("today", "2026-10-26")).toEqual({ dueOn: "2026-10-26" });
    expect(duesQuery("paid", "2026-10-26")).toEqual({ status: "paid" });
    expect(duesQuery("waived", "2026-10-26")).toEqual({ status: "waived" });
    expect(duesQuery("partial", "2026-10-26")).toEqual({ status: "partial" });
  });
});

describe("profile actions follow the state and the permissions (M24-FR-27 to FR-36)", () => {
  const freeze = (status: "scheduled" | "active" | "done" | "cancelled") => ({ id: "f", fromOn: "2026-10-01", toOn: "2026-10-05", endedEarlyOn: null, reason: "x", status });
  it("memberships: renew the latest running or ended one, freeze an active one, unfreeze a frozen one, change and cancel", () => {
    expect(membershipActions({ status: "active", freezes: [] }, { edit: true }, true)).toEqual(["renew", "freeze", "change", "cancel"]);
    expect(membershipActions({ status: "active", freezes: [] }, { edit: true }, false)).toEqual(["freeze", "change", "cancel"]);
    expect(membershipActions({ status: "frozen", freezes: [freeze("active")] }, { edit: true }, true)).toEqual(["renew", "unfreeze", "change", "cancel"]);
    expect(membershipActions({ status: "active", freezes: [freeze("scheduled")] }, { edit: true }, true)).toEqual(["renew", "unfreeze", "change", "cancel"]);
    expect(membershipActions({ status: "active", freezes: [freeze("done")] }, { edit: true }, true)).toEqual(["renew", "freeze", "change", "cancel"]);
    expect(membershipActions({ status: "expired", freezes: [] }, { edit: true }, true)).toEqual(["renew"]);
    expect(membershipActions({ status: "upcoming", freezes: [] }, { edit: true }, true)).toEqual(["cancel"]);
    expect(membershipActions({ status: "cancelled", freezes: [] }, { edit: true }, true)).toEqual([]);
    expect(membershipActions({ status: "changed", freezes: [] }, { edit: true }, true)).toEqual([]);
    expect(membershipActions({ status: "active", freezes: [] }, { edit: false }, true)).toEqual([]);
  });

  it("dues: collect with fees.collect and waive with fees.adjust while something is outstanding", () => {
    expect(dueActions({ status: "unpaid", outstandingPoisha: 100 }, { collect: true, adjust: true })).toEqual(["collect", "waive"]);
    expect(dueActions({ status: "partial", outstandingPoisha: 100 }, { collect: true, adjust: false })).toEqual(["collect"]);
    expect(dueActions({ status: "partial", outstandingPoisha: 100 }, { collect: false, adjust: true })).toEqual(["waive"]);
    expect(dueActions({ status: "unpaid", outstandingPoisha: 0 }, { collect: true, adjust: true })).toEqual([]);
    expect(dueActions({ status: "paid", outstandingPoisha: 0 }, { collect: true, adjust: true })).toEqual([]);
    expect(dueActions({ status: "waived" }, { collect: true, adjust: true })).toEqual([]);
    // Staff without money keys still see the open due (no amount) as collectable.
    expect(dueActions({ status: "unpaid" }, { collect: true, adjust: false })).toEqual(["collect"]);
  });

  it("payments: a counter payment reverses once with fees.adjust; online, opening and reversal rows never", () => {
    const p = { amountPoisha: 100, method: "cash" as const, reversedById: null, reversesId: null };
    expect(reversible(p, true)).toBe(true);
    expect(reversible(p, false)).toBe(false);
    expect(reversible({ ...p, reversedById: "r" }, true)).toBe(false);
    expect(reversible({ ...p, amountPoisha: -100, reversesId: "x" }, true)).toBe(false);
    expect(reversible({ ...p, method: "online" }, true)).toBe(false);
    expect(reversible({ ...p, method: "opening" }, true)).toBe(false);
  });
});

describe("check-in calendar and timers", () => {
  it("lays a month out Saturday first, padded to whole weeks, marking the days the member came", () => {
    const weeks = monthGrid("2026-11", ["2026-11-01", "2026-11-30"]); // 1 Nov 2026 is a Sunday
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toEqual({ date: "2026-11-01", day: 1, came: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.flat().filter((c) => c?.came).map((c) => c!.date)).toEqual(["2026-11-01", "2026-11-30"]);
    expect(monthGrid("2026-08", [])[0][0]).toEqual({ date: "2026-08-01", day: 1, came: false }); // a Saturday
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("refreshes the member QR a few seconds before it expires, never sooner than a second", () => {
    const now = Date.parse("2026-10-26T10:00:00Z");
    expect(qrRefreshIn("2026-10-26T10:00:30Z", now)).toBe(25000);
    expect(qrRefreshIn("2026-10-26T10:00:03Z", now)).toBe(1000);
    expect(qrRefreshIn("2026-10-26T09:59:00Z", now)).toBe(1000);
  });

  it("counts the import's undo window down", () => {
    const now = Date.parse("2026-10-26T10:00:00Z");
    expect(secondsLeft("2026-10-27T10:00:00Z", now)).toBe(86400);
    expect(secondsLeft("2026-10-26T09:00:00Z", now)).toBe(0);
    expect(secondsLeft(null, now)).toBe(0);
    expect(countdown(86400)).toBe("24:00:00");
    expect(countdown(3725)).toBe("1:02:05");
    expect(countdown(-3)).toBe("0:00:00");
  });
});

describe("plans and the tier upsell (M24-FR-07, §3.5)", () => {
  const tiers = [
    { key: "pro" as const, features: ["attendance", "reports", "multi_gym"] as const },
    { key: "free" as const, features: [] as const },
    { key: "standard" as const, features: ["attendance", "reports"] as const },
    { key: "basic" as const, features: ["attendance"] as const },
  ].map((t) => ({ ...t, features: [...t.features] }));
  it("locks a feature the plan lacks and names the lowest tier that has it", () => {
    expect(featureLocked({ attendance: false }, "attendance")).toBe(true);
    expect(featureLocked({ attendance: true }, "attendance")).toBe(false);
    expect(featureLocked(undefined, "attendance")).toBe(true);
    expect(minTierFor(tiers, "attendance")).toBe("basic");
    expect(minTierFor(tiers, "reports")).toBe("standard");
    expect(minTierFor(tiers, "multi_gym")).toBe("pro");
    expect(minTierFor(tiers, "plans")).toBeNull();
    expect(tiersInOrder(tiers).map((t) => t.key)).toEqual(["free", "basic", "standard", "pro"]);
  });
});

describe("packages (M24-FR-24): rows → the PUT body", () => {
  const row = (p: Partial<PackageRow>): PackageRow => ({ kind: "month", title: "Monthly", taka: "2500", days: "", admissionTaka: "", channel: "desk", visitLimit: "", on: true, ...p });
  it("builds the body in poisha with order, admission fee, custom days and visit limit", () => {
    expect(packagesPayload([row({}), row({ kind: "custom", title: "15 days", taka: "1200", days: "15", admissionTaka: "500", visitLimit: "12" }), row({ kind: "year", on: false })], 3)).toEqual({
      ok: true,
      packages: [
        { kind: "month", title: "Monthly", price: 250000, channel: "desk", sort: 0, visitLimit: null },
        { kind: "custom", title: "15 days", price: 120000, days: 15, admissionFee: 50000, channel: "desk", sort: 1, visitLimit: 12 },
      ],
    });
    expect(packagesPayload([row({ admissionTaka: "0" })], 3)).toMatchObject({ ok: true, packages: [{ admissionFee: 0 }] });
  });

  it("names the first problem and its row", () => {
    expect(packagesPayload([row({ on: false })], 3)).toEqual({ ok: false, problem: "none", row: -1 });
    expect(packagesPayload([row({}), row({ title: "Again" })], 3)).toEqual({ ok: false, problem: "duplicate_kind", row: 1 });
    expect(packagesPayload([row({ kind: "custom", days: "10" }), row({ kind: "custom", days: "10" })], 1)).toEqual({ ok: false, problem: "too_many_custom", row: 1 });
    expect(packagesPayload([row({ title: "M" })], 3)).toEqual({ ok: false, problem: "bad_title", row: 0 });
    expect(packagesPayload([row({ taka: "0" })], 3)).toEqual({ ok: false, problem: "bad_price", row: 0 });
    expect(packagesPayload([row({ kind: "custom", days: "400" })], 3)).toEqual({ ok: false, problem: "bad_days", row: 0 });
    expect(packagesPayload([row({ kind: "custom", days: "" })], 3)).toEqual({ ok: false, problem: "bad_days", row: 0 });
    expect(packagesPayload([row({ admissionTaka: "x" })], 3)).toEqual({ ok: false, problem: "bad_admission", row: 0 });
    expect(packagesPayload([row({ visitLimit: "0" })], 3)).toEqual({ ok: false, problem: "bad_visits", row: 0 });
  });

  it("turns saved packages into rows (by order) and offers the private gym's starters, month on", () => {
    const rows = packageRowsOf([
      { id: "b", kind: "year", title: "Yearly", price: 2000000, days: 365, admissionFee: 0, channel: "desk", visitLimit: null, sort: 1 },
      { id: "a", kind: "month", title: "Monthly", price: 250050, days: 30, admissionFee: 100000, channel: "both", visitLimit: 20, sort: 0 },
    ]);
    expect(rows.map((r) => [r.kind, r.taka, r.admissionTaka, r.channel, r.visitLimit])).toEqual([
      ["month", "2500.5", "1000", "both", "20"],
      ["year", "20000", "", "desk", ""],
    ]);
    const starters = starterRows({ month: "M", quarter: "Q", half_year: "H", year: "Y" });
    expect(starters.map((r) => [r.kind, r.on, r.channel])).toEqual([
      ["month", true, "desk"],
      ["quarter", false, "desk"],
      ["half_year", false, "desk"],
      ["year", false, "desk"],
    ]);
  });
});

describe("the package to sell online (M24-FR-24)", () => {
  const row = (kind: PackageRow["kind"], on = true) => ({ kind, on }) as PackageRow;
  it("is the monthly one if there is one, else the first in use", () => {
    expect(packageToSellOnline([row("quarter"), row("month")])?.kind).toBe("month");
    expect(packageToSellOnline([row("month", false), row("year")])?.kind).toBe("year");
    expect(packageToSellOnline([row("month", false)])).toBeNull();
    expect(packageToSellOnline([])).toBeNull();
  });
});

describe("import (M24-FR-75): template and preview", () => {
  it("builds the template CSV in the browser with the 11 columns and a quoted example", () => {
    const csv = importTemplateCsv(["Rahim, Jr", "01712345678", "male", "1995-04-21", "Monthly", "2026-10-01", "2026-10-30", "2026-10-01", "1500", "0", ""]);
    expect(csv.startsWith("﻿Name,Phone,Gender,Date of birth,Package,Start,End,Last payment date,Last payment amount,Amount due,Member code\r\n")).toBe(true);
    expect(csv).toContain('"Rahim, Jr",01712345678');
    expect(IMPORT_HEADERS).toHaveLength(11);
  });

  it("puts rows with errors first and counts them", () => {
    const r = (n: number, status: "ok" | "error", errors: { field: string; code: string }[] = []): ImportRow => ({ n, status, errors, displayName: `R${n}`, phoneLast4: "1234", memberCode: null, package: null, startsOn: null, endsOn: null, lastPaidPoisha: 0, lastPaidOn: null, amountDuePoisha: 0, memberId: null });
    const p = importPreview([r(2, "ok"), r(3, "error", [{ field: "phone", code: "phone_invalid" }]), r(4, "ok"), r(5, "error", [{ field: "package", code: "unknown_package" }, { field: "phone", code: "duplicate_phone_in_file" }])]);
    expect(p.rows.map((x) => x.n)).toEqual([3, 5, 2, 4]);
    expect([p.ok, p.failed]).toEqual([2, 2]);
    expect(p.fieldsWithErrors).toEqual(["package", "phone"]);
  });
});

describe("receipts (M24-FR-37)", () => {
  const gym = { id: "g", name: "PowerHouse", addressLine: "Mirpur", tin: null as string | null, bin: null as string | null, footer: null };
  it("prints the TIN and BIN lines only when entered, and 'Reversed on' when reversed", () => {
    expect(receiptLines({ gym, reversed: null })).toEqual({ tin: null, bin: null, reversedOn: null });
    expect(receiptLines({ gym: { ...gym, tin: " 123456789012 ", bin: "  " }, reversed: { on: "2026-10-26", at: "2026-10-26T10:00:00Z" } })).toEqual({ tin: "123456789012", bin: null, reversedOn: "2026-10-26" });
  });

  it("opens the API's receipt link on this site, and the page knows loading, not found and ready", () => {
    expect(receiptPath("https://gym.kriraghor.com/r/abc.def")).toBe("/r/abc.def");
    expect(receiptPath("http://localhost:3003/r/tok")).toBe("/r/tok");
    expect(receiptPath("https://evil.example/elsewhere")).toBeNull();
    expect(receiptPath(null)).toBeNull();
    expect(receiptState({ isPending: true, error: null })).toBe("loading");
    expect(receiptState({ isPending: false, error: { code: "NOT_FOUND", status: 404, title: "x" } })).toBe("notFound");
    expect(receiptState({ isPending: false, error: { code: "SERVER", status: 500, title: "x" } })).toBe("error");
    expect(receiptState({ isPending: false, error: null, data: { receiptNo: "PM-R26-000001" } as never })).toBe("ready");
  });
});

describe("gym settings: only what changed is sent", () => {
  const s: GymSettings = { gymId: "g", setupDone: true, shortCode: "PM", tin: null, bin: null, receiptFooter: null, entryPolicy: "warn", absentAlertDays: null, absentAlertDaysDefault: 10, joinRequestsOpen: true, remindersOff: [], smsKinds: [], importConsentUntil: null, nextMemberCode: "PM-0002" };
  it("sends nothing for an untouched form, and blank text as null", () => {
    expect(settingsPatch(s, draftOf(s))).toEqual({});
    expect(settingsPatch(s, { ...draftOf(s), shortCode: "pmx", tin: " 123 ", entryPolicy: "block", absentAlertDays: "14", joinRequestsOpen: false })).toEqual({ shortCode: "PMX", tin: "123", entryPolicy: "block", absentAlertDays: 14, joinRequestsOpen: false });
    expect(settingsPatch({ ...s, tin: "1", absentAlertDays: 7 }, { ...draftOf({ ...s, tin: "1", absentAlertDays: 7 }), tin: "", absentAlertDays: "" })).toEqual({ tin: null, absentAlertDays: null });
  });
});
