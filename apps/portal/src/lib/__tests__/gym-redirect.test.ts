import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gymRedirect } from "../gym-redirect";
import { gymHref } from "../links";

const GYM = "https://gym.kriraghor.com";

describe("old vendor gym URLs → gym.kriraghor.com/manage (M24 §4.3)", () => {
  it("sends every gym desk to its new home", () => {
    expect(gymRedirect("/vendor/gyms", "", GYM)).toBe(`${GYM}/manage`);
    expect(gymRedirect("/vendor/gyms/", "", GYM)).toBe(`${GYM}/manage`);
    expect(gymRedirect("/vendor/gyms/y1", "", GYM)).toBe(`${GYM}/manage/y1/edit`);
    expect(gymRedirect("/vendor/gyms/y1/", "", GYM)).toBe(`${GYM}/manage/y1/edit`);
    expect(gymRedirect("/vendor/gyms/y1/desk", "", GYM)).toBe(`${GYM}/manage/y1/desk`);
    expect(gymRedirect("/vendor/gyms/y1/passes", "", GYM)).toBe(`${GYM}/manage/y1/passes`);
    expect(gymRedirect("/vendor/gyms/y1/members/m2", "", GYM)).toBe(`${GYM}/manage/y1/members/m2`);
  });

  it("keeps the query string", () => {
    expect(gymRedirect("/vendor/gyms", "?tab=x", GYM)).toBe(`${GYM}/manage?tab=x`);
    expect(gymRedirect("/vendor/gyms/y1/desk", "?date=2026-10-25&utm_source=sms", GYM)).toBe(`${GYM}/manage/y1/desk?date=2026-10-25&utm_source=sms`);
    expect(gymRedirect("/vendor/gyms/y1", "?", GYM)).toBe(`${GYM}/manage/y1/edit`);
    expect(gymRedirect("/vendor/gyms/y1", "", `${GYM}/`)).toBe(`${GYM}/manage/y1/edit`);
  });

  it("leaves the shared business pages and everything else alone", () => {
    for (const p of ["/vendor", "/vendor/team", "/vendor/reviews", "/vendor/payouts", "/vendor/analytics", "/vendor/gymsx", "/vendor/venues", "/admin/gym", "/gyms", "/manage"]) {
      expect(gymRedirect(p, "", GYM), p).toBeNull();
    }
  });

  it("reaches the gym app through /go/gym", () => {
    expect(gymHref("/manage")).toBe("/go/gym/manage");
    expect(gymHref("manage/y1/desk")).toBe("/go/gym/manage/y1/desk");
  });
});

// The proxy matcher, read as text (importing proxy.ts pulls in next-intl's middleware): /go/ must reach
// its route handler on both hosts, so the area redirect never turns /go/gym into /vendor/go/gym.
const source = readFileSync(path.join(__dirname, "..", "..", "proxy.ts"), "utf8");
const pattern = JSON.parse(source.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)![1]) as string;
const matches = (p: string) => new RegExp(`^${pattern}$`).test(p);

describe("portal proxy matcher", () => {
  it("runs on pages", () => {
    for (const p of ["/", "/vendor", "/vendor/gyms", "/vendor/gyms/y1/desk", "/admin/gym", "/vendor/team"]) expect(matches(p), p).toBe(true);
  });

  it("skips files, Next internals, the API, /go/ and /env.js", () => {
    for (const p of ["/logo.png", "/_next/static/chunk.js", "/api/health", "/go/gym/manage", "/env.js"]) expect(matches(p), p).toBe(false);
  });
});
