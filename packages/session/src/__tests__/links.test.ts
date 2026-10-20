import { describe, expect, it } from "vitest";
import { crossSiteHref, crossSiteRedirect, isExternal } from "../links";
import { redirectFor } from "../redirects";

describe("cross-site links", () => {
  it("builds /go hrefs and safe redirects", () => {
    expect(crossSiteHref("/go/esports")).toBe("/go/esports");
    expect(crossSiteHref("/go/esports", "events")).toBe("/go/esports/events");
    expect(crossSiteHref("/go/web", "/help")).toBe("/go/web/help");
    expect(crossSiteRedirect("https://esports.kriraghor.com/", ["events", "..", "a b"], "?x=1")).toBe("https://esports.kriraghor.com/events/a%20b?x=1");
    expect(crossSiteRedirect("https://www.kriraghor.com", [], "?")).toBe("https://www.kriraghor.com/");
    expect(isExternal("/go/web/help")).toBe(true);
    expect(isExternal("https://example.com")).toBe(true);
    expect(isExternal("/venues")).toBe(false);
  });

  it("matches one segment and the rest of a path", () => {
    const table = [
      { source: "/t/:slug", destination: "/events/:slug", permanent: true as const },
      { source: "/vendor/grounds/:path*", destination: "/vendor/venues/:path*", permanent: true as const },
    ];
    expect(redirectFor("/t/clutch-cup", table)).toBe("/events/clutch-cup");
    expect(redirectFor("/vendor/grounds/abc/courts", table)).toBe("/vendor/venues/abc/courts");
    expect(redirectFor("/t/a/b", table)).toBeNull();
  });
});
