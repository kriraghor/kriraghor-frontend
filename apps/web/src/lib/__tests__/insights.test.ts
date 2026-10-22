import { describe, expect, it } from "vitest";
import { bucketLabel, compactTaka, hasEarnings, percent, periodOf, ratingText, replyTime } from "../insights";
import { incomplete, playerStepHref, proStepHref, PLAYER_STEPS, PRO_STEPS } from "../completeness";
import { avatarErrorOf, avatarFileProblem, megabytes } from "../avatar";
import { publicLimit, publicSetting } from "../public-settings";

// Round B1: pro insights (M11 §4, M19 §6.3), profile checklists and the profile photo (M01).
describe("insights formatting", () => {
  it("reads the period from the URL, defaulting to 7 weeks", () => {
    expect(periodOf("qtr")).toBe("qtr");
    expect(periodOf("yr")).toBe("yr");
    expect(periodOf("month")).toBe("7w");
    expect(periodOf(null)).toBe("7w");
  });

  it("shows shares as whole percents and nothing as null", () => {
    expect(percent(87.5)).toBe("88%");
    expect(percent(90, "bn")).toBe("৯০%");
    expect(percent(null)).toBeNull();
    expect(percent(undefined)).toBeNull();
  });

  it("says a reply time in minutes, hours or days", () => {
    expect(replyTime(null)).toBeNull();
    expect(replyTime(undefined)).toBeNull();
    expect(replyTime(0)).toEqual({ unit: "min", n: 1 });
    expect(replyTime(25)).toEqual({ unit: "min", n: 25 });
    expect(replyTime(150)).toEqual({ unit: "hours", n: 3 });
    expect(replyTime(3000)).toEqual({ unit: "days", n: 2 });
  });

  it("labels bars by week or month, money short, and the rating to one decimal", () => {
    expect(bucketLabel({ key: "2026-10-12", from: "2026-10-12" }, "7w")).toBe("12 Oct");
    expect(bucketLabel({ key: "2026-10", from: "2026-10-01" }, "yr")).toBe("Oct");
    expect(bucketLabel({ key: "2026-10-12", from: "2026-10-12" }, "qtr", "bn")).toContain("১২");
    expect(compactTaka(1250000)).toBe("৳12.5k");
    expect(compactTaka(80000)).toBe("৳800");
    expect(compactTaka(80000, "bn")).toBe("৳৮০০");
    expect(ratingText({ avg: 4.56, count: 12 })).toBe("4.6");
    expect(ratingText({ avg: 4, count: 1 }, "bn")).toBe("৪.০");
    expect(ratingText({ avg: null, count: 0 })).toBeNull();
    expect(ratingText({ avg: 4, count: 0 })).toBeNull();
    expect(hasEarnings({ buckets: [{ key: "a", from: "a", amount: 0 }] })).toBe(false);
    expect(hasEarnings({ buckets: [{ key: "a", from: "a", amount: 0 }, { key: "b", from: "b", amount: 100 }] })).toBe(true);
  });
});

describe("checklist step links", () => {
  it("sends each pro step to where it is fixed", () => {
    const links = Object.fromEntries(PRO_STEPS.map((k) => [k, proStepHref(k, "p1")]));
    expect(links).toEqual({
      photo: "/account/settings#photo",
      headline: "/pro/profiles/p1#pro-headline",
      bio: "/pro/profiles/p1#pro-bio",
      rateCard: "/pro/profiles/p1#pro-rates",
      credential: "/account/business?as=pro",
      policeClearance: "/account/business?as=pro",
      availability: "/pro/availability",
      payoutAccount: "/me/payout-account",
    });
    expect(proStepHref("credential", "p1", "player")).toBe("/account/business?as=player");
    expect(proStepHref("unknown", "p1")).toBeNull();
  });

  it("sends each player step to where it is fixed", () => {
    expect(Object.fromEntries(PLAYER_STEPS.map((k) => [k, playerStepHref(k)]))).toEqual({
      sports: "#player-sports",
      bio: "#player-bio",
      team: "/me/teams",
      esportsUid: "/go/esports/me/esports",
      nid: "/account/verification",
    });
    expect(playerStepHref("unknown")).toBeNull();
  });

  it("hides the card when everything is done", () => {
    expect(incomplete({ score: 60, steps: [{ key: "bio", done: false }] })).toBe(true);
    expect(incomplete({ score: 100, steps: [{ key: "bio", done: true }] })).toBe(false);
    expect(incomplete({ score: 99, steps: [{ key: "bio", done: true }] })).toBe(false);
    expect(incomplete(null)).toBe(false);
    expect(incomplete(undefined)).toBe(false);
  });
});

describe("profile photo checks", () => {
  const MB = 1048576;
  it("checks the type and size before sending", () => {
    expect(avatarFileProblem({ type: "image/png", size: 0 }, 2 * MB)).toBe("empty");
    expect(avatarFileProblem({ type: "image/gif", size: 100 }, 2 * MB)).toBe("type");
    expect(avatarFileProblem({ type: "image/jpeg", size: 3 * MB }, 2 * MB)).toBe("tooLarge");
    expect(avatarFileProblem({ type: "image/webp", size: 2 * MB }, 2 * MB)).toBeNull();
    // Settings not loaded: the server decides the size.
    expect(avatarFileProblem({ type: "image/jpeg", size: 30 * MB }, null)).toBeNull();
    expect(megabytes(2 * MB)).toBe("2");
    expect(megabytes(1.5 * MB)).toBe("1.5");
  });

  it("maps the server's file codes", () => {
    const p = (code: string) => ({ code, status: 415, title: "t" });
    expect(avatarErrorOf(p("FILE_EMPTY"))).toBe("empty");
    expect(avatarErrorOf(p("FILE_TOO_LARGE"))).toBe("tooLarge");
    expect(avatarErrorOf(p("FILE_TYPE_NOT_ALLOWED"))).toBe("type");
    expect(avatarErrorOf(p("FILE_TYPE_MISMATCH"))).toBe("mismatch");
    expect(avatarErrorOf(p("RATE_LIMITED"))).toBeNull();
    expect(avatarErrorOf(new Error("offline"))).toBeNull();
  });

  it("reads public settings by dotted key, limits only when they are positive numbers", () => {
    const s = { users: { avatarMaxBytes: 2097152 }, hire: { availabilityHorizonDays: 60, off: null }, version: 3 };
    expect(publicSetting(s, "hire.availabilityHorizonDays", 0)).toBe(60);
    expect(publicSetting(s, "hire.off", 7)).toBe(7);
    expect(publicSetting(s, "hire.missing", 7)).toBe(7);
    expect(publicSetting(s, "version.deeper", "x")).toBe("x");
    expect(publicSetting(undefined, "users.avatarMaxBytes", 1)).toBe(1);
    expect(publicLimit(s, "users.avatarMaxBytes")).toBe(2097152);
    expect(publicLimit({ users: { avatarMaxBytes: "2MB" } }, "users.avatarMaxBytes")).toBeNull();
    expect(publicLimit({ users: { avatarMaxBytes: 0 } }, "users.avatarMaxBytes")).toBeNull();
    expect(publicLimit(undefined, "users.avatarMaxBytes")).toBeNull();
  });
});
