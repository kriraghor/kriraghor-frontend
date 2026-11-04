import { describe, expect, it } from "vitest";
import { REDIRECTS, redirectFor } from "../redirects";

describe("old URLs (Grounds → Venues, Tournaments → Events)", () => {
  it("sends every old page to its new home", () => {
    expect(redirectFor("/grounds")).toBe("/venues");
    expect(redirectFor("/grounds/mirpur-turf-10")).toBe("/venues/mirpur-turf-10");
    expect(redirectFor("/tournaments")).toBe("/events");
    expect(redirectFor("/tournaments/dhaka-futsal-cup")).toBe("/events/dhaka-futsal-cup");
    expect(redirectFor("/tournaments/dhaka-futsal-cup/register")).toBe("/events/dhaka-futsal-cup/register");
    expect(redirectFor("/me/tournaments")).toBe("/me/events");
  });

  it("leaves the new and unrelated pages alone, and every redirect is permanent", () => {
    for (const p of ["/venues", "/events/x", "/shop", "/grounds/a/b"]) expect(redirectFor(p)).toBeNull();
    expect(REDIRECTS.every((r) => r.permanent)).toBe(true);
  });
});
