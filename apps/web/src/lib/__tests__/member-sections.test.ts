import { describe, expect, it } from "vitest";
import { activeSection } from "@kriraghor/ui/sections";
import { canWork, memberSections } from "../member-sections";

const t = (k: string) => k;
const member = { roles: [{ role: "member", status: "active" }], phoneVerified: true, kycStatus: "none" };
const pro = { ...member, roles: [...member.roles, { role: "pro", status: "in_review" }] };
const keys = (me?: Parameters<typeof memberSections>[1]) => memberSections(t, me).map((s) => s.key);

describe("the kriraghor.com member sections", () => {
  it("lists the core features in rail order, Account pinned last", () => {
    const s = memberSections(t, member);
    expect(s.map((x) => x.key)).toEqual(["home", "esports", "events", "venues", "gym", "shop", "hire", "money", "help", "account"]);
    expect(s.at(-1)).toMatchObject({ key: "account", pin: "bottom" });
    expect(s.filter((x) => x.pin === "bottom")).toHaveLength(1);
  });

  it("adds Work, after Hire, for a player or pro who is applying or active", () => {
    expect(keys(pro)).toEqual(["home", "esports", "events", "venues", "gym", "shop", "hire", "work", "money", "help", "account"]);
    const work = memberSections(t, pro).find((x) => x.key === "work")!;
    expect(work.href).toBe("/pro");
    expect(work.items.map((i) => i.href)).toEqual(["/pro", "/pro/requests", "/pro/jobs", "/pro/availability", "/pro/earnings", "/pro/plans", "/pro/reviews"]);
  });

  it("hides Work while loading, for members, and for withdrawn or rejected roles", () => {
    expect(keys(undefined)).not.toContain("work");
    expect(keys(member)).not.toContain("work");
    expect(canWork([{ role: "pro", status: "rejected" }, { role: "player", status: "withdrawn" }])).toBe(false);
    expect(canWork([{ role: "player", status: "changes_requested" }])).toBe(true);
    expect(canWork([{ role: "ground_owner", status: "active" }])).toBe(false);
    expect(canWork(undefined)).toBe(false);
  });

  it("keeps every old test id once, on the same destination", () => {
    const ids = Object.fromEntries(memberSections(t, pro).flatMap((s) => s.items.filter((i) => i.testId).map((i) => [i.testId!, i.href])));
    expect(ids).toEqual({
      "me-tournaments": "/me/events",
      "me-esports": "/go/esports/me/matches",
      "me-teams": "/me/teams",
      "me-player": "/me/player",
      "me-eligibility": "/me/eligibility",
      "me-hire": "/me/hire",
      "me-bookings": "/me/bookings",
      "me-passes": "/go/gym/me/passes",
      "me-subscriptions": "/go/gym/me/subscriptions",
      "me-orders": "/me/orders",
      "me-saved": "/shop/saved",
      "me-pro": "/pro",
      "me-disputes": "/me/disputes",
      "me-settings": "/account/settings",
      "me-verification": "/account/verification",
      "me-open-shop": "/account/business",
    });
  });

  it("Esports and Gym open a landing on kriraghor.com; their tabs go to the other site", () => {
    const s = memberSections(t, member);
    for (const key of ["esports", "gym"]) {
      const x = s.find((y) => y.key === key)!;
      expect(x.href).toBe(`/me/${key}`);
      expect(x.items.every((i) => i.href.startsWith(`/go/${key}`))).toBe(true);
    }
  });

  it("rolls the unread count up to Account through the Notifications tab", () => {
    const acc = memberSections(t, member, 3).find((x) => x.key === "account")!;
    expect(acc.items.find((i) => i.href === "/me/notifications")?.badge).toBe(3);
  });

  it("labels follow the member: add a phone, verify or verified", () => {
    const label = (me: Parameters<typeof memberSections>[1], href: string) =>
      memberSections(t, me)
        .flatMap((s) => s.items)
        .find((i) => i.href === href)?.label;
    expect(label({ ...member, phoneVerified: false }, "/me/eligibility")).toBe("items.addPhone");
    expect(label(member, "/me/eligibility")).toBe("items.ready");
    expect(label(undefined, "/me/eligibility")).toBe("items.ready");
    expect(label(member, "/account/verification")).toBe("items.verify");
    expect(label({ ...member, kycStatus: "verified" }, "/account/verification")).toBe("items.verified");
  });

  it("finds the section for real member pages", () => {
    const s = memberSections(t, pro);
    const at = (p: string) => {
      const a = activeSection(s, p);
      return a ? `${a.section.key}:${a.item?.href ?? "-"}` : null;
    };
    expect(at("/me")).toBe("home:-");
    expect(at("/me/esports")).toBe("esports:-");
    expect(at("/me/gym")).toBe("gym:-");
    expect(at("/me/bookings/BK-1")).toBe("venues:/me/bookings");
    expect(at("/me/teams/t1")).toBe("events:/me/teams");
    expect(at("/me/eligibility")).toBe("events:/me/eligibility");
    expect(at("/me/orders/OR-9")).toBe("shop:/me/orders");
    expect(at("/me/hire/HR-2")).toBe("hire:/me/hire");
    expect(at("/pro/profiles/p1")).toBe("work:/pro");
    expect(at("/pro/earnings")).toBe("work:/pro/earnings");
    expect(at("/me/payout-account")).toBe("money:/me/payout-account");
    expect(at("/me/disputes/D-1")).toBe("help:/me/disputes");
    expect(at("/me/notifications/settings")).toBe("account:/me/notifications");
    expect(at("/account/business")).toBe("account:/account/business");
  });
});
