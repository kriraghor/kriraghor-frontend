import { describe, expect, it } from "vitest";
import { House, Trophy } from "@phosphor-icons/react";
import { activeSection, onPath, sectionBadge, type ShellSection } from "../sections";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";

const S = (key: string, href: string, items: [string, ("exact" | "prefix")?][], extra: Partial<ShellSection> = {}): ShellSection => ({
  key,
  label: key,
  icon: House,
  href,
  items: items.map(([h, match]) => ({ href: h, label: h, icon: Trophy, match })),
  ...extra,
});

const sections: ShellSection[] = [
  S("home", "/me", [], { match: "exact" }),
  S("esports", "/me/esports", [["/go/esports/me/matches"], ["/go/esports/me/esports"], ["/go/esports"]]),
  S("events", "/me/events", [["/me/events"], ["/me/teams"], ["/me/player"]]),
  S("venues", "/me/bookings", [["/me/bookings"]]),
  S("work", "/pro", [["/pro"], ["/pro/requests"], ["/pro/jobs"]]),
  S("account", "/account/settings", [["/account/settings"], ["/me/notifications"], ["/account/verification"]], { pin: "bottom" }),
];
const at = (path: string) => {
  const a = activeSection(sections, path);
  return a ? [a.section.key, a.item?.href ?? null] : null;
};

describe("activeSection (the member area's rail and tabs)", () => {
  it("Home is exact: /me is Home, with no tab", () => {
    expect(at("/me")).toEqual(["home", null]);
  });

  it("an unknown page under /me belongs to no section (Home is exact)", () => {
    expect(at("/me/unknown")).toBeNull();
    expect(at("/elsewhere")).toBeNull();
  });

  it("a section's own link and its first tab agree", () => {
    expect(at("/me/events")).toEqual(["events", "/me/events"]);
    expect(at("/me/teams")).toEqual(["events", "/me/teams"]);
  });

  it("detail pages keep their section and parent tab (prefix)", () => {
    expect(at("/me/bookings/42")).toEqual(["venues", "/me/bookings"]);
    expect(at("/me/teams/abc")).toEqual(["events", "/me/teams"]);
    expect(at("/pro/profiles/new")).toEqual(["work", "/pro"]);
    expect(at("/me/notifications/settings")).toEqual(["account", "/me/notifications"]);
  });

  it("the longest match wins (/pro/requests over /pro)", () => {
    expect(at("/pro/requests")).toEqual(["work", "/pro/requests"]);
    expect(at("/pro")).toEqual(["work", "/pro"]);
  });

  it("does not match a sibling that only shares a prefix of letters", () => {
    expect(at("/me/eventsx")).toBeNull();
    expect(onPath("/pro", "/professional")).toBe(false);
    expect(onPath("/me", "/me/x", "exact")).toBe(false);
  });

  it("tabs on another site are never active; a landing page has its section and no tab", () => {
    expect(at("/me/esports")).toEqual(["esports", null]);
    expect(at("/go/esports/me/matches")).toBeNull();
    expect(at("/go/esports")).toBeNull();
  });

  it("without the Work section (no pro role) /pro belongs to no section", () => {
    const noWork = sections.filter((s) => s.key !== "work");
    expect(activeSection(noWork, "/pro/requests")).toBeNull();
    expect(activeSection(noWork, "/me/bookings")?.section.key).toBe("venues");
  });

  it("a section's badge is its own, or the sum of its tabs' badges", () => {
    const acc = { ...sections[5], items: sections[5].items.map((it, i) => ({ ...it, badge: i === 1 ? 4 : i === 2 ? -1 : undefined })) };
    expect(sectionBadge(acc)).toBe(4);
    expect(sectionBadge({ ...acc, badge: 9 })).toBe(9);
    expect(sectionBadge(sections[0])).toBe(0);
  });
});

describe("member area messages", () => {
  const groups = ["sections", "tabs"] as const;
  const leaves = (o: unknown, at = ""): [string, string][] =>
    typeof o === "string" ? [[at, o]] : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));

  it("every section, tab and landing label has a Bangla twin in Bangla script", () => {
    for (const g of [...groups, "landing"] as const) {
      const e = leaves(en.account[g]);
      const b = new Map(leaves(bn.account[g]));
      expect(e.length).toBeGreaterThan(0);
      for (const [k] of e) {
        expect(b.get(k), `account.${g}.${k}`).toBeTruthy();
        expect(b.get(k)).toMatch(/[ঀ-৿]/);
      }
    }
    expect(Object.keys(bn.kit.sections).sort()).toEqual(Object.keys(en.kit.sections).sort());
  });

  it("uses no em or en dashes in the new copy", () => {
    const all = [en, bn].flatMap((m) => [...leaves(m.account.sections), ...leaves(m.account.tabs), ...leaves(m.account.landing), ...leaves(m.kit.sections)]);
    for (const [k, v] of all) expect(v, k).not.toMatch(/[–—]/);
  });
});
