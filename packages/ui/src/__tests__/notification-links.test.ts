import { describe, expect, it } from "vitest";
import { resolveNotificationLink, siteOfBell, siteOfPath } from "../notifications/links";

const urls = { webUrl: "https://kriraghor.com", vendorUrl: "https://vendor.kriraghor.com/", adminUrl: "https://admin.kriraghor.com", esportsUrl: "https://esports.kriraghor.com", gymUrl: "https://gym.kriraghor.com" };

describe("resolveNotificationLink (M08 bell links across sites)", () => {
  it("on the business panel: /vendor stays in the app, member and staff links go to their sites", () => {
    expect(resolveNotificationLink("/vendor/venues/g1", { here: "vendor", ...urls })).toEqual({ href: "/vendor/venues/g1", external: false });
    expect(resolveNotificationLink("/vendor", { here: "vendor", ...urls })).toEqual({ href: "/vendor", external: false });
    expect(resolveNotificationLink("/me/payouts", { here: "vendor", ...urls })).toEqual({ href: "https://kriraghor.com/me/payouts", external: true });
    expect(resolveNotificationLink("/account/business?as=shop", { here: "vendor", ...urls })).toEqual({ href: "https://kriraghor.com/account/business?as=shop", external: true });
    expect(resolveNotificationLink("/admin/fees", { here: "vendor", ...urls })).toEqual({ href: "https://admin.kriraghor.com/admin/fees", external: true });
  });

  it("on kriraghor.com: member pages stay, desk links leave (trailing slash on the base trimmed)", () => {
    expect(resolveNotificationLink("/me/orders/K-1", { here: "web", ...urls })).toEqual({ href: "/me/orders/K-1", external: false });
    expect(resolveNotificationLink("/vendor/shop", { here: "web", ...urls })).toEqual({ href: "https://vendor.kriraghor.com/vendor/shop", external: true });
    expect(resolveNotificationLink("/leaderboards", { here: "web", ...urls })).toEqual({ href: "https://esports.kriraghor.com/leaderboards", external: true });
  });

  it("on the admin desk: /admin stays, /vendor and /me leave", () => {
    expect(resolveNotificationLink("/admin/moderation?id=1", { here: "admin", ...urls })).toEqual({ href: "/admin/moderation?id=1", external: false });
    expect(resolveNotificationLink("/vendor/events", { here: "admin", ...urls })).toEqual({ href: "https://vendor.kriraghor.com/vendor/events", external: true });
    expect(resolveNotificationLink("/me", { here: "admin", ...urls })).toEqual({ href: "https://kriraghor.com/me", external: true });
  });

  it("on esports: its own pages stay, the account on kriraghor.com leaves", () => {
    expect(resolveNotificationLink("/me/winnings", { here: "esports", ...urls })).toEqual({ href: "/me/winnings", external: false });
    expect(resolveNotificationLink("/events/pubg-weekly", { here: "esports", ...urls })).toEqual({ href: "/events/pubg-weekly", external: false });
    expect(resolveNotificationLink("/me/payout-account", { here: "esports", ...urls })).toEqual({ href: "https://kriraghor.com/me/payout-account", external: true });
  });

  it("gym pages open on gym.kriraghor.com from every other site (M24 §4.3)", () => {
    for (const here of ["web", "vendor", "admin", "esports"] as const) {
      expect(resolveNotificationLink("/manage/g1/edit", { here, ...urls })).toEqual({ href: "https://gym.kriraghor.com/manage/g1/edit", external: true });
      expect(resolveNotificationLink("/me/passes/GP-31XZ", { here, ...urls })).toEqual({ href: "https://gym.kriraghor.com/me/passes/GP-31XZ", external: true });
      expect(resolveNotificationLink("/me/subscriptions", { here, ...urls })).toEqual({ href: "https://gym.kriraghor.com/me/subscriptions", external: true });
      expect(resolveNotificationLink("/gyms/iron-house?x=1", { here, ...urls })).toEqual({ href: "https://gym.kriraghor.com/gyms/iron-house?x=1", external: true });
    }
    // Trainer-side links stay on kriraghor.com (Hire).
    expect(resolveNotificationLink("/pro/subscriptions", { here: "web", ...urls })).toEqual({ href: "/pro/subscriptions", external: false });
  });

  it("on gym: its own pages stay, everything else leaves for its site", () => {
    for (const p of ["/manage", "/manage/g1/desk", "/gyms", "/me/passes", "/me/subscriptions", "/start", "/me/notifications"]) expect(resolveNotificationLink(p, { here: "gym", ...urls })).toEqual({ href: p, external: false });
    expect(resolveNotificationLink("/me/payouts", { here: "gym", ...urls })).toEqual({ href: "https://kriraghor.com/me/payouts", external: true });
    expect(resolveNotificationLink("/pro/subscriptions", { here: "gym", ...urls })).toEqual({ href: "https://kriraghor.com/pro/subscriptions", external: true });
    expect(resolveNotificationLink("/vendor/reviews", { here: "gym", ...urls })).toEqual({ href: "https://vendor.kriraghor.com/vendor/reviews", external: true });
    expect(resolveNotificationLink("/leaderboards", { here: "gym", ...urls })).toEqual({ href: "https://esports.kriraghor.com/leaderboards", external: true });
    expect(resolveNotificationLink("https://gym.kriraghor.com/me/passes/GP-1", { here: "gym", ...urls })).toEqual({ href: "https://gym.kriraghor.com/me/passes/GP-1", external: true });
    expect(siteOfPath("/gymnastics", "web")).toBe("web");
    expect(siteOfPath("/managers", "gym")).toBe("web");
  });

  it("leaves a link relative when the other site's URL is not configured", () => {
    expect(resolveNotificationLink("/vendor/shop", { here: "web", webUrl: urls.webUrl })).toEqual({ href: "/vendor/shop", external: false });
    expect(resolveNotificationLink("/me", { here: "vendor", webUrl: "not a url" })).toEqual({ href: "/me", external: false });
  });

  it("opens absolute http links as they are and refuses anything unsafe or empty", () => {
    expect(resolveNotificationLink("https://kriraghor.com/help", { here: "vendor", ...urls })).toEqual({ href: "https://kriraghor.com/help", external: true });
    expect(resolveNotificationLink("//evil.example/x", { here: "web", ...urls })).toBeNull();
    expect(resolveNotificationLink("javascript:alert(1)", { here: "web", ...urls })).toBeNull();
    expect(resolveNotificationLink("", { here: "web", ...urls })).toBeNull();
    expect(resolveNotificationLink(null, { here: "web", ...urls })).toBeNull();
  });

  it("does not mistake lookalike prefixes", () => {
    expect(siteOfPath("/vendors-guide", "web")).toBe("web");
    expect(siteOfPath("/administer", "vendor")).toBe("web");
    expect(siteOfPath("/admin?x=1", "web")).toBe("admin");
  });
});

describe("siteOfBell", () => {
  it("reads the site from the bell's See all link, and esports from the page origin", () => {
    expect(siteOfBell("/admin/notifications", null)).toBe("admin");
    expect(siteOfBell("/vendor/notifications", null)).toBe("vendor");
    expect(siteOfBell("/me/notifications", "https://esports.kriraghor.com", urls.esportsUrl)).toBe("esports");
    expect(siteOfBell("/me/notifications", "https://kriraghor.com", urls.esportsUrl)).toBe("web");
    expect(siteOfBell("/me/notifications", "https://kriraghor.com", "::bad::")).toBe("web");
    expect(siteOfBell("/me/notifications", "https://gym.kriraghor.com", urls.esportsUrl, urls.gymUrl)).toBe("gym");
    expect(siteOfBell("/me/notifications", "https://kriraghor.com", urls.esportsUrl, urls.gymUrl)).toBe("web");
    expect(siteOfBell("/me/notifications", "https://gym.kriraghor.com", urls.esportsUrl, "::bad::")).toBe("web");
  });
});
