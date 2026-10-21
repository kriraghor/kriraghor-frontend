import { describe, expect, it } from "vitest";
import {
  errorKey,
  isCurrentStaff,
  nextRoleStatuses,
  plainProblem,
  roleStatusNeedsReason,
  roleStatusTone,
  sanctionState,
  searchQuery,
  untilIso,
  untilProblem,
  userActions,
  userStatusTone,
} from "../admin/users";

const NOW = Date.parse("2026-10-21T06:00:00Z"); // 12:00 in Dhaka
const DAY = 24 * 3600 * 1000;
const member = (over: Partial<{ id: string; status: string; staff: { status: string; isMaster: boolean; employeeId: string; team: string | null; twoFactorEnabled: boolean } | null }> = {}) =>
  ({ id: "u1", status: "active", staff: null, ...over }) as never;
const staffer = (status = "active") => ({ status, isMaster: false, employeeId: "KG-01", team: null, twoFactorEnabled: true });
const master = { id: "m1", isMaster: true };
const agent = { id: "s1", isMaster: false };

describe("users search (M01-FR-19)", () => {
  it("only sends a trimmed query of 2–100 characters (searches are audited)", () => {
    expect(searchQuery("")).toBeUndefined();
    expect(searchQuery(" a ")).toBeUndefined();
    expect(searchQuery(null)).toBeUndefined();
    expect(searchQuery("  ra ")).toBe("ra");
    expect(searchQuery("x".repeat(120))).toHaveLength(100);
  });
});

describe("suspension end date", () => {
  it("means the end of that day in Dhaka", () => {
    expect(untilIso("2026-10-25")).toBe("2026-10-25T23:59:59+06:00");
  });
  it("is optional, must be a real future date within a year", () => {
    expect(untilProblem("", NOW)).toBeNull();
    expect(untilProblem("25/10/2026", NOW)).toBe("invalid");
    expect(untilProblem("2026-13-45", NOW)).toBe("invalid");
    expect(untilProblem("2026-10-20", NOW)).toBe("past");
    expect(untilProblem("2026-10-21", NOW)).toBeNull(); // today until midnight is still ahead
    expect(untilProblem("2027-10-20", NOW)).toBeNull();
    expect(untilProblem("2027-10-22", NOW)).toBe("tooLong");
  });
});

describe("userActions (guards match the API)", () => {
  it("offers nothing without a viewer or on your own account", () => {
    const none = { suspend: false, restore: false, ban: false, unban: false, signOut: false, gender: false, roles: false };
    expect(userActions(member(), null)).toEqual(none);
    expect(userActions(member({ id: "s1" }), agent)).toEqual(none);
  });
  it("lets only masters act on staff accounts still in post", () => {
    expect(userActions(member({ staff: staffer() }), agent).suspend).toBe(false);
    expect(userActions(member({ staff: staffer() }), master).suspend).toBe(true);
    expect(userActions(member({ staff: staffer("offboarded") }), agent).suspend).toBe(true);
    expect(isCurrentStaff(member({ staff: staffer("invited") }))).toBe(true);
    expect(isCurrentStaff(member())).toBe(false);
  });
  it("suspends active accounts, restores suspended ones, bans and unbans only as a master", () => {
    expect(userActions(member(), agent)).toEqual({ suspend: true, restore: false, ban: false, unban: false, signOut: true, gender: true, roles: true });
    expect(userActions(member(), master).ban).toBe(true);
    const suspended = member({ status: "suspended" });
    expect(userActions(suspended, agent)).toMatchObject({ suspend: false, restore: true, ban: false });
    expect(userActions(suspended, master)).toMatchObject({ restore: true, ban: true });
    const banned = member({ status: "banned" });
    expect(userActions(banned, agent)).toMatchObject({ restore: false, unban: false, ban: false });
    expect(userActions(banned, master)).toMatchObject({ restore: false, unban: true, ban: false });
    const closed = member({ status: "closed" });
    expect(userActions(closed, master)).toEqual({ suspend: false, restore: false, ban: false, unban: false, signOut: false, gender: false, roles: false });
  });
});

describe("role status changes", () => {
  it("follows the API's transitions and never touches staff roles", () => {
    expect(nextRoleStatuses("pro", "applied")).toEqual(["in_review", "active", "rejected"]);
    expect(nextRoleStatuses("member", "documents_pending")).toEqual(["in_review", "rejected"]);
    expect(nextRoleStatuses("ground_owner", "in_review")).toEqual(["active", "changes_requested", "rejected"]);
    expect(nextRoleStatuses("player", "active")).toEqual(["suspended"]);
    expect(nextRoleStatuses("player", "suspended")).toEqual(["active"]);
    expect(nextRoleStatuses("player", "withdrawn")).toEqual([]);
    expect(nextRoleStatuses("player", "rejected")).toEqual([]);
    expect(nextRoleStatuses("staff", "active")).toEqual([]);
    expect(nextRoleStatuses("master_admin", "active")).toEqual([]);
  });
  it("needs a reason to suspend, reject or ask for changes", () => {
    expect(roleStatusNeedsReason("suspended")).toBe(true);
    expect(roleStatusNeedsReason("rejected")).toBe(true);
    expect(roleStatusNeedsReason("changes_requested")).toBe(true);
    expect(roleStatusNeedsReason("active")).toBe(false);
    expect(roleStatusNeedsReason("in_review")).toBe(false);
  });
});

describe("sanctions and tones", () => {
  it("reads a sanction as in force, lifted or ended", () => {
    expect(sanctionState({ liftedAt: null, endsAt: null }, NOW)).toBe("active");
    expect(sanctionState({ liftedAt: null, endsAt: new Date(NOW + DAY).toISOString() }, NOW)).toBe("active");
    expect(sanctionState({ liftedAt: null, endsAt: new Date(NOW - DAY).toISOString() }, NOW)).toBe("ended");
    expect(sanctionState({ liftedAt: new Date(NOW).toISOString(), endsAt: null }, NOW)).toBe("lifted");
  });
  it("colours statuses", () => {
    expect(["active", "suspended", "banned", "closed"].map(userStatusTone)).toEqual(["brand", "warning", "danger", "neutral"]);
    expect(["active", "applied", "documents_pending", "in_review", "changes_requested", "rejected", "suspended", "withdrawn"].map(roleStatusTone)).toEqual([
      "brand",
      "info",
      "info",
      "info",
      "warning",
      "danger",
      "danger",
      "neutral",
    ]);
  });
});

describe("plain-language errors", () => {
  it("knows the desk's problem codes", () => {
    expect(errorKey({ code: "SELF_ACTION_FORBIDDEN", title: "x", status: 403 })).toBe("SELF_ACTION_FORBIDDEN");
    expect(errorKey({ code: "LAST_MASTER", title: "x", status: 409 })).toBe("LAST_MASTER");
    expect(errorKey({ code: "SOMETHING_NEW", title: "x", status: 409 })).toBeNull();
    expect(errorKey(new Error("boom"))).toBeNull();
  });
  it("swaps in a plain title for known codes and keeps the API's otherwise", () => {
    const explain = (k: string) => `plain:${k}`;
    expect(plainProblem({ code: "MASTER_REQUIRED", title: "Only a master", status: 403, detail: "x" }, explain)).toEqual({ code: "MASTER_REQUIRED", title: "plain:MASTER_REQUIRED", status: 403, detail: undefined });
    expect(plainProblem({ code: "ODD", title: "Odd", status: 409 }, explain)).toEqual({ code: "ODD", title: "Odd", status: 409 });
    expect(plainProblem("nope", explain)).toMatchObject({ code: "UNKNOWN" });
  });
});
