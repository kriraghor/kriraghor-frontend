import { describe, expect, it } from "vitest";
import { metaFor, PRIVATE_PATHS, robotsFor, siteUrl, SITEMAP_MAX, sitemapEntries, STATIC_PATHS, summary } from "../seo";
import { esportsHref, esportsRedirect, isExternal } from "../links";

const SITE = "https://www.kriraghor.com";

describe("seo (launch polish)", () => {
  it("reads the site origin from WEB_URL, without a trailing slash", () => {
    expect(siteUrl({ WEB_URL: "https://www.kriraghor.com/" })).toBe(SITE);
    expect(siteUrl({})).toBe(SITE);
  });

  it("summarises text for a meta description at a word boundary", () => {
    expect(summary("  A   small\nground  ")).toBe("A small ground");
    const s = summary("Floodlit five-a-side turf ".repeat(10));
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith("…")).toBe(true);
    expect(summary(null)).toBe("");
    expect(summary("x".repeat(200)).length).toBe(160);
  });

  it("describes a ground, with structured data, in both languages", () => {
    const g = { name: "Mirpur Turf 10", slug: "mirpur-turf-10", description: "", area: { nameEn: "Mirpur", nameBn: "মিরপুর" }, addressLine: "Road 10", photos: [{ url: "/files/a.jpg" }], lat: 23.8, lng: 90.36, ratingAvg: 4.6, ratingCount: 12 };
    const m = metaFor("ground", g, "en", SITE);
    expect(m.title).toBe("Mirpur Turf 10, Mirpur");
    expect(m.description).toBe("Mirpur Turf 10 · Mirpur · Book a slot online");
    expect(m.image).toBe(`${SITE}/files/a.jpg`);
    expect(m.jsonLd).toMatchObject({ "@type": "SportsActivityLocation", url: `${SITE}/venues/mirpur-turf-10`, geo: { latitude: 23.8 }, aggregateRating: { ratingCount: 12 } });
    expect(metaFor("ground", { ...g, area: null, photos: [], lat: null, ratingCount: 0 }, "bn", SITE)).toMatchObject({ title: "Mirpur Turf 10", image: null });
    expect(metaFor("ground", g, "bn", SITE).title).toBe("Mirpur Turf 10, মিরপুর");
  });

  it("describes products, shops, people, gyms, tournaments and players", () => {
    expect(metaFor("product", { title: "Kashmir willow bat", brand: "SS", photos: [{ url: "https://cdn.example/b.jpg" }], shop: { name: "Gulshan Sports" } }, "en").title).toBe("Kashmir willow bat (SS)");
    expect(metaFor("product", { title: "Bat", description: null, shop: null }, "en")).toMatchObject({ title: "Bat", description: "Bat", image: null });
    expect(metaFor("shop", { name: "Gulshan Sports", about: "Cricket specialists.", area: null }, "en").description).toBe("Cricket specialists.");
    expect(metaFor("hire", { name: "Kamrul Islam", headline: null, bio: null, role: { nameEn: "Umpire", nameBn: "আম্পায়ার" }, area: null }, "bn")).toMatchObject({ title: "Kamrul Islam · আম্পায়ার" });
    expect(metaFor("gym", { name: "Iron House", about: null, area: { nameEn: "Uttara", nameBn: "উত্তরা" }, cover: null, photos: [{ url: "/g.jpg" }] }, "en", SITE).image).toBe(`${SITE}/g.jpg`);
    const t = metaFor("tournament", { name: "Dhaka Futsal Cup", slug: "dhaka-futsal-cup", description: null, sport: { nameEn: "Futsal", nameBn: "ফুটসাল" }, startDate: "2026-11-07", endDate: null, status: "cancelled", organisation: { name: "Kriraghor" } }, "en", SITE);
    expect(t.description).toBe("Dhaka Futsal Cup · Futsal · Kriraghor");
    expect(t.jsonLd).toMatchObject({ "@type": "SportsEvent", startDate: "2026-11-07", eventStatus: "https://schema.org/EventCancelled", organizer: { name: "Kriraghor" } });
    expect(metaFor("tournament", { name: "Cup", slug: "cup", status: "registration_open", organisation: null }, "en", SITE).jsonLd).toMatchObject({ eventStatus: "https://schema.org/EventScheduled" });
    expect(metaFor("player", { displayName: "Rafi Ahmed", bio: null, handle: "rafi" }, "en").description).toBe("Rafi Ahmed (@rafi)");
  });

  it("lists static pages, then each source's slugs, unique and capped", () => {
    const e = sitemapEntries(SITE, { grounds: ["a", "a", "b c"], tournaments: ["cup"] });
    expect(e.slice(0, STATIC_PATHS.length).map((x) => x.url)).toContain(`${SITE}/venues`);
    expect(e.map((x) => x.url).slice(STATIC_PATHS.length)).toEqual([`${SITE}/venues/a`, `${SITE}/venues/b%20c`, `${SITE}/events/cup`]);
    expect(e.some((x) => PRIVATE_PATHS.some((p) => x.url.startsWith(`${SITE}${p}`)))).toBe(false);
    // When the API is down there are no slugs: the static pages alone.
    expect(sitemapEntries(SITE, {})).toHaveLength(STATIC_PATHS.length);
    // The gym pages moved to gym.kriraghor.com (its own sitemap), 25 Oct 2026.
    expect(sitemapEntries(SITE, { gyms: ["iron-house"] } as never).some((x) => x.url.includes("/gym"))).toBe(false);
    const many = Array.from({ length: SITEMAP_MAX + 10 }, (_, i) => `g${i}`);
    expect(sitemapEntries(SITE, { grounds: many })).toHaveLength(SITEMAP_MAX);
  });

  it("indexes production only, never the private pages", () => {
    for (const env of ["prod", "production"]) {
      const r = robotsFor(env, SITE);
      expect(r.sitemap).toBe(`${SITE}/sitemap.xml`);
      expect(r.rules[0]).toMatchObject({ userAgent: "*", allow: "/" });
      expect((r.rules[0] as { disallow: string[] }).disallow).toEqual(expect.arrayContaining(["/me", "/account", "/pay", "/sign-in"]));
    }
    expect(robotsFor("staging", SITE)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    expect(robotsFor("local", SITE).rules[0]).toMatchObject({ disallow: "/" });
  });

  it("sends esports links through /go/esports and back to the esports host only", () => {
    expect(esportsHref()).toBe("/go/esports");
    expect(esportsHref("/t/x")).toBe("/go/esports/t/x");
    expect(esportsHref("leaderboards")).toBe("/go/esports/leaderboards");
    expect(esportsRedirect("https://esports.kriraghor.com/", ["t", "daily cup"], "?ref=home")).toBe("https://esports.kriraghor.com/t/daily%20cup?ref=home");
    expect(esportsRedirect("https://esports.kriraghor.com", ["..", "//evil.example", "."], "?")).toBe("https://esports.kriraghor.com/%2F%2Fevil.example");
    expect(esportsRedirect("https://esports.kriraghor.com", [])).toBe("https://esports.kriraghor.com/");
    expect(isExternal("/go/esports")).toBe(true);
    expect(isExternal("https://example.com")).toBe(true);
    expect(isExternal("/venues")).toBe(false);
  });
});
