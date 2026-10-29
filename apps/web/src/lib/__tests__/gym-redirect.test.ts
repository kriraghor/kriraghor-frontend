import { describe, expect, it } from "vitest";
import { gymRedirect } from "../gym-redirect";
import { gymHref } from "../links";

const GYM = "https://gym.kriraghor.com";

describe("old gym URLs on kriraghor.com → gym.kriraghor.com (M24 §4.3)", () => {
  it("sends the hub to /gyms, keeping its tab only where the new hub needs it", () => {
    expect(gymRedirect("/gym", "", GYM)).toBe(`${GYM}/gyms`);
    expect(gymRedirect("/gym/", "", GYM)).toBe(`${GYM}/gyms`);
    expect(gymRedirect("/gym", "?tab=gyms", GYM)).toBe(`${GYM}/gyms`);
    expect(gymRedirect("/gym", "?tab=gyms&areaId=a1&sort=rating", GYM)).toBe(`${GYM}/gyms?areaId=a1&sort=rating`);
    expect(gymRedirect("/gym", "?tab=trainers", GYM)).toBe(`${GYM}/trainers`);
    expect(gymRedirect("/gym", "?tab=trainers&utm_source=fb", GYM)).toBe(`${GYM}/trainers?utm_source=fb`);
  });

  it("sends the gear tab to the shop's gym category on kriraghor.com (a same-site path)", () => {
    expect(gymRedirect("/gym", "?tab=gear", GYM)).toBe("/shop?category=gym");
    expect(gymRedirect("/gym", "?tab=gear&utm_source=fb", GYM)).toBe("/shop?utm_source=fb&category=gym");
  });

  it("sends a gym page to the same slug, and anything else under /gym to /gyms", () => {
    expect(gymRedirect("/gym/gyms/iron-house", "", GYM)).toBe(`${GYM}/gyms/iron-house`);
    expect(gymRedirect("/gym/gyms/iron-house", "?ref=share", GYM)).toBe(`${GYM}/gyms/iron-house?ref=share`);
    expect(gymRedirect("/gym/gyms/iron-house/", "", GYM)).toBe(`${GYM}/gyms/iron-house`);
    expect(gymRedirect("/gym/gyms", "", GYM)).toBe(`${GYM}/gyms`);
    expect(gymRedirect("/gym/trainers/x", "?a=1", GYM)).toBe(`${GYM}/gyms?a=1`);
  });

  it("sends passes and trainer subscriptions to the same path, query kept", () => {
    expect(gymRedirect("/me/passes", "", GYM)).toBe(`${GYM}/me/passes`);
    expect(gymRedirect("/me/passes", "?show=used", GYM)).toBe(`${GYM}/me/passes?show=used`);
    expect(gymRedirect("/me/passes/GP-31XZ", "", GYM)).toBe(`${GYM}/me/passes/GP-31XZ`);
    expect(gymRedirect("/me/subscriptions", "", GYM)).toBe(`${GYM}/me/subscriptions`);
    expect(gymRedirect("/me/subscriptions/s1", "?x=1", GYM)).toBe(`${GYM}/me/subscriptions/s1?x=1`);
  });

  it("trims a trailing slash on the gym URL", () => {
    expect(gymRedirect("/me/passes", "", `${GYM}/`)).toBe(`${GYM}/me/passes`);
    expect(gymRedirect("/gym", "", "http://localhost:3003/")).toBe("http://localhost:3003/gyms");
  });

  it("leaves every other page alone, trainers' Hire pages included", () => {
    for (const p of ["/", "/gyms", "/gymnastics", "/gym-gear", "/shop", "/me", "/me/passes/a/b", "/me/payouts", "/me/subscriptionsx", "/pro/plans", "/pro/subscriptions", "/hiring/coach-rafi", "/vendor/gyms"]) {
      expect(gymRedirect(p, "?tab=gear", GYM), p).toBeNull();
    }
  });
});

describe("gymHref", () => {
  it("reaches gym.kriraghor.com through /go/gym", () => {
    expect(gymHref()).toBe("/go/gym");
    expect(gymHref("/me/passes")).toBe("/go/gym/me/passes");
    expect(gymHref("gyms/iron-house")).toBe("/go/gym/gyms/iron-house");
  });
});
