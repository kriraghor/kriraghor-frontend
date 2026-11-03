import { describe, expect, it } from "vitest";
import { REDIRECTS, redirectFor } from "../redirects";

describe("old URLs (Grounds → Venues, organised Events → the Tournaments feed)", () => {
  it("sends every old page to its new home", () => {
    expect(redirectFor("/grounds")).toBe("/venues");
    expect(redirectFor("/grounds/mirpur-turf-10")).toBe("/venues/mirpur-turf-10");
    expect(redirectFor("/events")).toBe("/tournaments");
    expect(redirectFor("/events/dhaka-futsal-cup")).toBe("/tournaments");
    expect(redirectFor("/events/dhaka-futsal-cup/register")).toBe("/tournaments");
    expect(redirectFor("/me/events")).toBe("/me/tournaments");
    expect(redirectFor("/me/teams")).toBe("/me");
    expect(redirectFor("/me/teams/t1")).toBe("/me");
    expect(redirectFor("/teams/join/abc")).toBe("/me");
    expect(redirectFor("/me/eligibility")).toBe("/account/settings");
  });

  it("leaves the new and unrelated pages alone, and every redirect is permanent", () => {
    for (const p of ["/venues", "/tournaments", "/tournaments/x", "/me/tournaments", "/shop", "/grounds/a/b"]) expect(redirectFor(p)).toBeNull();
    expect(REDIRECTS.every((r) => r.permanent)).toBe(true);
  });
});
