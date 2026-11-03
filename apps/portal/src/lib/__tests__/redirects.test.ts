import { describe, expect, it } from "vitest";
import { REDIRECTS, redirectFor } from "../redirects";

describe("old desk URLs (Venues, Showcases, the organiser panel)", () => {
  it("sends every old desk page to its new home", () => {
    expect(redirectFor("/vendor/grounds")).toBe("/vendor/venues");
    expect(redirectFor("/vendor/grounds/g1/pricing")).toBe("/vendor/venues/g1/pricing");
    for (const old of ["/vendor/tournaments", "/vendor/tournaments/o1", "/vendor/tournaments/o1/t/t1", "/vendor/events", "/vendor/events/o1", "/vendor/events/o1/members", "/vendor/events/o1/e/t1", "/vendor/esports/o1/tournaments", "/vendor/esports/o1/tournaments/t1"]) {
      expect(redirectFor(old)).toBe("/vendor");
    }
    expect(redirectFor("/admin/grounds")).toBe("/admin/venues");
    expect(redirectFor("/admin/tournaments")).toBe("/admin/sports-events");
    expect(redirectFor("/admin/esports/events")).toBe("/admin/esports/showcases");
  });

  it("keeps the outbox desk and the new pages", () => {
    for (const p of ["/admin/events", "/admin/venues", "/vendor", "/admin/esports", "/admin/tournament-posts"]) expect(redirectFor(p)).toBeNull();
    expect(REDIRECTS.every((r) => r.permanent)).toBe(true);
  });
});
