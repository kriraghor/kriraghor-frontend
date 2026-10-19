import { describe, expect, it } from "vitest";
import { REDIRECTS, redirectFor } from "../redirects";

describe("old desk URLs (Venues, Events, Showcases)", () => {
  it("sends every old desk page to its new home", () => {
    expect(redirectFor("/vendor/grounds")).toBe("/vendor/venues");
    expect(redirectFor("/vendor/grounds/g1/pricing")).toBe("/vendor/venues/g1/pricing");
    expect(redirectFor("/vendor/tournaments")).toBe("/vendor/events");
    expect(redirectFor("/vendor/tournaments/o1")).toBe("/vendor/events/o1");
    expect(redirectFor("/vendor/tournaments/o1/t/t1")).toBe("/vendor/events/o1/e/t1");
    expect(redirectFor("/vendor/esports/o1/tournaments")).toBe("/vendor/esports/o1/events");
    expect(redirectFor("/vendor/esports/o1/tournaments/t1")).toBe("/vendor/esports/o1/events/t1");
    expect(redirectFor("/admin/grounds")).toBe("/admin/venues");
    expect(redirectFor("/admin/tournaments")).toBe("/admin/sports-events");
    expect(redirectFor("/admin/esports/events")).toBe("/admin/esports/showcases");
  });

  it("keeps the outbox desk and the new pages", () => {
    for (const p of ["/admin/events", "/admin/venues", "/vendor/events/o1", "/admin/esports"]) expect(redirectFor(p)).toBeNull();
    expect(REDIRECTS.every((r) => r.permanent)).toBe(true);
  });
});
