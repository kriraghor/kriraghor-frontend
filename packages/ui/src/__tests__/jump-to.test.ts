import { describe, expect, it } from "vitest";
import { Gear, Money, UsersThree } from "@phosphor-icons/react";
import { jumpMatches, type JumpItem } from "../JumpTo";

const items: JumpItem[] = [
  { href: "/manage/g1/members", label: "Members", icon: UsersThree, group: "People" },
  { href: "/manage/g1/fees", label: "Fees", icon: Money, group: "Money" },
  { href: "/manage/g1/fees/closing", label: "Close the day", icon: Money, group: "Money" },
  { href: "/manage/g1/settings", label: "Settings", icon: Gear, group: "Setup" },
  { href: "/manage/g1/payroll", label: "Staff pay", icon: Money, group: "Team" },
  { href: "/manage/g1/sms", label: "সদস্যদের এসএমএস", icon: UsersThree, group: "সদস্য" },
];
const hrefs = (q: string, limit?: number) => jumpMatches(items, q, limit).map((i) => i.href);

describe("Jump to: which pages match what was typed", () => {
  it("shows the first pages when nothing is typed, up to the limit", () => {
    expect(hrefs("", 3)).toEqual(["/manage/g1/members", "/manage/g1/fees", "/manage/g1/fees/closing"]);
    expect(hrefs("   ")).toHaveLength(6);
  });

  it("puts a label that starts with the word first, then a word that starts with it, then one that contains it", () => {
    expect(hrefs("f")).toEqual(["/manage/g1/fees", "/manage/g1/payroll"]);
    expect(hrefs("pay")).toEqual(["/manage/g1/payroll"]);
    expect(hrefs("day")).toEqual(["/manage/g1/fees/closing"]);
    expect(hrefs("taff")).toEqual(["/manage/g1/payroll"]);
  });

  it("ignores case and accents, and needs every word, in any order", () => {
    expect(hrefs("CLOSE day")).toEqual(["/manage/g1/fees/closing"]);
    expect(hrefs("day close")).toEqual(["/manage/g1/fees/closing"]);
    expect(hrefs("clôse")).toEqual(["/manage/g1/fees/closing"]);
    expect(hrefs("close week")).toEqual([]);
  });

  it("finds a page by its group's name, after the label matches", () => {
    expect(hrefs("money")).toEqual(["/manage/g1/fees", "/manage/g1/fees/closing"]);
    expect(hrefs("setup")).toEqual(["/manage/g1/settings"]);
  });

  it("works in Bangla", () => {
    expect(hrefs("এসএমএস")).toEqual(["/manage/g1/sms"]);
    expect(hrefs("সদস্য")).toEqual(["/manage/g1/sms"]);
  });

  it("finds nothing for a word that is nowhere", () => {
    expect(hrefs("zumba")).toEqual([]);
  });
});
