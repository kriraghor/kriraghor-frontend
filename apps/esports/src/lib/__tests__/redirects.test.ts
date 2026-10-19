import { describe, expect, it } from "vitest";
import { REDIRECTS, redirectFor } from "../redirects";

describe("old URLs (tournaments → Events, big events → Showcases)", () => {
  it("sends every old page to its new home", () => {
    expect(redirectFor("/tournaments")).toBe("/events");
    expect(redirectFor("/t/daily-booyah-cup")).toBe("/events/daily-booyah-cup");
    expect(redirectFor("/t/daily-booyah-cup/register")).toBe("/events/daily-booyah-cup/register");
    expect(redirectFor("/e/kriraghor-pro-series")).toBe("/showcases/kriraghor-pro-series");
  });

  it("keeps /events (now the events list), the home page and the organiser rewrite untouched", () => {
    for (const p of ["/events", "/", "/o/clutch", "/showcases", "/leaderboards"]) expect(redirectFor(p)).toBeNull();
    expect(REDIRECTS.every((r) => r.permanent)).toBe(true);
  });
});
