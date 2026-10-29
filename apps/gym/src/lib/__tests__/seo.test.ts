import { describe, expect, it } from "vitest";
import { gymMeta, PRIVATE_PATHS, robotsFor, siteUrl, SITEMAP_MAX, sitemapEntries, STATIC_PATHS, summary } from "../seo";
import { safeNext, webHref } from "../links";

const SITE = "https://gym.kriraghor.com";

describe("gym SEO", () => {
  it("reads the site from GYM_URL", () => {
    expect(siteUrl({ GYM_URL: "http://localhost:3003/" })).toBe("http://localhost:3003");
    expect(siteUrl({})).toBe(SITE);
  });

  it("describes a gym page: name and area, about text, cover or first photo", () => {
    const g = { name: "Iron House", about: null, area: { nameEn: "Uttara", nameBn: "উত্তরা" }, cover: null, photos: [{ url: "/g.jpg" }] };
    expect(gymMeta(g, "en", SITE)).toEqual({ title: "Iron House, Uttara", description: "Iron House · Uttara", image: `${SITE}/g.jpg` });
    expect(gymMeta(g, "bn", SITE).title).toBe("Iron House, উত্তরা");
    expect(gymMeta({ name: "Lift", about: "  Open   all day ", cover: "https://cdn.example/c.jpg" }, "en", SITE)).toEqual({ title: "Lift", description: "Open all day", image: "https://cdn.example/c.jpg" });
    expect(summary("x".repeat(200)).length).toBeLessThanOrEqual(160);
  });

  it("lists the landing page, the hub, then each gym once, capped", () => {
    const e = sitemapEntries(SITE, ["iron-house", "iron-house", "a b"]);
    expect(e.map((x) => x.url)).toEqual([SITE, `${SITE}/gyms`, `${SITE}/trainers`, `${SITE}/gyms/iron-house`, `${SITE}/gyms/a%20b`]);
    expect(sitemapEntries(SITE, [])).toHaveLength(STATIC_PATHS.length);
    expect(sitemapEntries(SITE, Array.from({ length: SITEMAP_MAX + 5 }, (_, i) => `g${i}`))).toHaveLength(SITEMAP_MAX);
    expect(e.some((x) => PRIVATE_PATHS.some((p) => x.url.startsWith(`${SITE}${p}`)))).toBe(false);
  });

  it("indexes production only, never the account or management pages", () => {
    expect(robotsFor("staging", SITE)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    const r = robotsFor("prod", SITE);
    expect(r.sitemap).toBe(`${SITE}/sitemap.xml`);
    expect(PRIVATE_PATHS).toEqual(expect.arrayContaining(["/me", "/manage", "/start", "/r/", "/pay/", "/p/"]));
  });
});

describe("links back to kriraghor.com", () => {
  it("goes through /go/web and keeps ?next= on this site", () => {
    expect(webHref("/shop?category=gym")).toBe("/go/web/shop?category=gym");
    expect(webHref()).toBe("/go/web");
    expect(safeNext("/start")).toBe("/start");
    expect(safeNext("//evil.example")).toBe("/me/passes");
    expect(safeNext("https://evil.example")).toBe("/me/passes");
    expect(safeNext(null, "/manage")).toBe("/manage");
  });
});
