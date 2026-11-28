import { describe, expect, it } from "vitest";
import { BREAKPOINT, navFitsIn } from "../SiteHeader";

// Tester feedback, 28 Nov 2026: links were hidden between 768 and 899px (gym) and overlapped the actions
// on esports at narrow desktop widths.
describe("site header", () => {
  it("switches where the stylesheet does (tokens.css md 900px, lg 1180px)", () => {
    expect(BREAKPOINT).toEqual({ md: 900, lg: 1180 });
  });

  it("keeps the centred links in the top row only while they fit between equal side columns", () => {
    // Esports at 1024px: logo 232, actions 270, five links 520 → 520 + 2×270 + 48 = 1108 > 984.
    expect(navFitsIn({ row: 984, logo: 232, actions: 270, links: 520 })).toBe(false);
    // The same at 1300px.
    expect(navFitsIn({ row: 1260, logo: 232, actions: 270, links: 520 })).toBe(true);
    // Exactly enough.
    expect(navFitsIn({ row: 1108, logo: 232, actions: 270, links: 520 })).toBe(true);
    // Not laid out yet (0 wide): leave the links where the server put them.
    expect(navFitsIn({ row: 0, logo: 232, actions: 270, links: 520 })).toBe(true);
  });
});
