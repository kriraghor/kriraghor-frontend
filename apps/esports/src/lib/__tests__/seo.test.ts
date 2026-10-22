import { describe, expect, it } from "vitest";
import { keysFrom, mainGame, playerCard, playerMeta, robotsFor, showcaseMeta, siteUrl, sitemapEntries, SITEMAP_MAX, STATIC_PATHS, summary, taka, tournamentMeta, type Translate } from "../seo";

/** A translator that shows the key and its values, so the tests read the wiring, not the wording. */
const t: Translate = (key, values) => (values ? `${key}(${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(",")})` : key);

const pubg = { key: "pubgm", nameEn: "PUBG Mobile", nameBn: "পাবজি মোবাইল" };
const ff = { key: "ff", nameEn: "Free Fire", nameBn: "ফ্রি ফায়ার" };
const player = {
  userId: "u1",
  username: "shadow",
  displayName: "Shadow",
  tournaments: 9,
  wins: 3,
  kills: 140,
  games: [
    { game: ff, ign: "ShadowFF", uidMasked: "12****89", rank: 40, points: 120.4, tournaments: 2, wins: 0, kills: 20 },
    { game: pubg, ign: "SHADOW", uidMasked: "51****02", rank: 3, points: 1240.6, tournaments: 7, wins: 3, kills: 120 },
  ],
};

describe("siteUrl", () => {
  it("reads ESPORTS_URL without a trailing slash, with a default", () => {
    expect(siteUrl({ ESPORTS_URL: "https://esports.staging.kriraghor.com/" })).toBe("https://esports.staging.kriraghor.com");
    expect(siteUrl({})).toBe("https://esports.kriraghor.com");
  });
});

describe("mainGame", () => {
  it("is the best-ranked game, else the first, else null", () => {
    expect(mainGame(player)?.ign).toBe("SHADOW");
    expect(mainGame({ username: "x", games: [{ game: ff, ign: "A", rank: null }, { game: pubg, ign: "B", rank: null }] })?.ign).toBe("A");
    expect(mainGame({ username: "x" })).toBeNull();
  });
});

describe("playerMeta", () => {
  it("titles 'IGN · game' and describes rank, points, wins and kills", () => {
    expect(playerMeta(player, "en", t)).toEqual({
      title: "SHADOW · PUBG Mobile",
      description: "SHADOW: meta.rank(n=3,game=PUBG Mobile) · meta.points(n=1,241) · meta.wins(n=3) · meta.kills(n=140).",
      image: null,
    });
  });

  it("an unranked player with no games falls back to the name and says unranked", () => {
    const m = playerMeta({ username: "ghost", displayName: null, games: [] }, "en", t);
    expect(m.title).toBe("ghost");
    expect(m.description).toBe("ghost: meta.unranked · meta.wins(n=0) · meta.kills(n=0).");
    expect(playerMeta({ username: null }, "en", t).title).toBe("meta.player");
  });

  it("uses Bangla game names and digits in Bangla", () => {
    expect(playerMeta(player, "bn", t).title).toBe("SHADOW · পাবজি মোবাইল");
    expect(playerMeta(player, "bn", t).description).toContain("meta.rank(n=৩,game=পাবজি মোবাইল)");
  });
});

describe("tournamentMeta", () => {
  const d = { titleEn: "Friday Night Erangel", titleBn: "শুক্রবার রাতের এরাঙ্গেল", game: pubg, prizePool: { amount: 1_000_000 }, entryFee: { amount: 5000 }, startsAt: "2026-10-23T14:00:00Z" };

  it("has the title and game, prize pool, entry and start day (Dhaka)", () => {
    expect(tournamentMeta(d, "en", t)).toEqual({
      title: "Friday Night Erangel",
      description: "PUBG Mobile · meta.prizePool(amount=৳10,000) · meta.entry(amount=৳50) · meta.starts(date=23 Oct 2026)",
      image: null,
    });
  });

  it("free entry, no prize, no date; Bangla title", () => {
    const m = tournamentMeta({ ...d, prizePool: { amount: 0 }, entryFee: { amount: 0 }, startsAt: undefined }, "bn", t);
    expect(m.title).toBe("শুক্রবার রাতের এরাঙ্গেল");
    expect(m.description).toBe("পাবজি মোবাইল · meta.freeEntry");
    expect(tournamentMeta({ titleEn: "", titleBn: "" }, "en", t).title).toBe("meta.event");
  });
});

describe("showcaseMeta", () => {
  const e = {
    event: {
      titleEn: "Kriraghor Cup",
      titleBn: "ক্রীড়াঘর কাপ",
      taglineEn: "Eight squads, one crown",
      taglineBn: null,
      aboutMdEn: "## About\nThe **biggest** night.",
      aboutMdBn: "",
      bannerUrl: "/media/cup.jpg",
      startsAt: "2026-11-01T12:00:00Z",
      endsAt: "2026-11-02T16:00:00Z",
      prizeTotal: { amount: 5_000_000 },
    },
  };

  it("tagline, dates and prize total; the banner as an absolute image", () => {
    expect(showcaseMeta(e, "en", t, "https://esports.kriraghor.com")).toEqual({
      title: "Kriraghor Cup",
      description: "Eight squads, one crown. 1 Nov 2026 – 2 Nov 2026 · meta.prizePool(amount=৳50,000)",
      image: "https://esports.kriraghor.com/media/cup.jpg",
    });
  });

  it("without a tagline uses the about text (markdown stripped); one-day events show one date", () => {
    const m = showcaseMeta({ event: { ...e.event, taglineEn: null, bannerUrl: null, endsAt: "2026-11-01T15:00:00Z" } }, "en", t);
    expect(m.description).toBe("About The biggest night.");
    expect(m.image).toBeNull();
    const n = showcaseMeta({ event: { ...e.event, taglineEn: null, aboutMdEn: "", endsAt: "2026-11-01T15:00:00Z", prizeTotal: { amount: 0 } } }, "en", t);
    expect(n.description).toBe("1 Nov 2026");
    expect(showcaseMeta(e, "bn", t).title).toBe("ক্রীড়াঘর কাপ");
    expect(showcaseMeta({}, "en", t)).toEqual({ title: "meta.showcase", description: "", image: null });
  });
});

describe("playerCard", () => {
  it("game above the IGN, @username under it, rank, points, wins and kills (never the UID)", () => {
    const c = playerCard(player, "en", t)!;
    expect(c).toEqual({
      eyebrow: "PUBG Mobile",
      title: "SHADOW",
      subtitle: "@shadow",
      stats: [
        { label: "og.rank", value: "#3" },
        { label: "og.points", value: "1,241" },
        { label: "og.wins", value: "3" },
        { label: "og.kills", value: "140" },
      ],
    });
    expect(JSON.stringify(c)).not.toContain("****");
  });

  it("an unranked player gets wins and kills only; no name at all is null", () => {
    const c = playerCard({ username: null, displayName: "Nobody", games: [], wins: 0, kills: 2 }, "bn", t)!;
    expect(c).toEqual({ eyebrow: null, title: "Nobody", subtitle: null, stats: [{ label: "og.wins", value: "০" }, { label: "og.kills", value: "২" }] });
    expect(playerCard({ username: null }, "en", t)).toBeNull();
    expect(playerCard(null, "en", t)).toBeNull();
  });
});

describe("helpers", () => {
  it("taka formats poisha, with Bangla digits in Bangla", () => {
    expect(taka(150050, "en")).toBe("৳1,500.5");
    expect(taka(100000, "bn")).toBe("৳১,০০০");
  });

  it("summary cuts long text at a word", () => {
    const s = summary("word ".repeat(60), 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("sitemap", () => {
  it("keysFrom skips drafts and items without the field", () => {
    expect(keysFrom("slug", [{ slug: "a" }, { slug: "b", status: "draft" }, { slug: "c", phase: "draft" }, { slug: "" }, { id: 1 }])).toEqual(["a"]);
    expect(keysFrom("username", undefined)).toEqual([]);
  });

  it("lists static pages, then events, showcases and players, unique and encoded", () => {
    const out = sitemapEntries("https://esports.kriraghor.com", { events: ["fn-1", "fn-1"], showcases: ["cup"], players: ["shadow x"] });
    expect(out.slice(0, STATIC_PATHS.length).map((e) => e.url)).toEqual(["https://esports.kriraghor.com", "https://esports.kriraghor.com/events", "https://esports.kriraghor.com/showcases", "https://esports.kriraghor.com/leaderboards"]);
    expect(out.slice(STATIC_PATHS.length)).toEqual([
      { url: "https://esports.kriraghor.com/events/fn-1", changeFrequency: "daily", priority: 0.7 },
      { url: "https://esports.kriraghor.com/showcases/cup", changeFrequency: "daily", priority: 0.7 },
      { url: "https://esports.kriraghor.com/p/shadow%20x", changeFrequency: "weekly", priority: 0.5 },
    ]);
  });

  it("stops at the cap", () => {
    const many = Array.from({ length: SITEMAP_MAX + 10 }, (_, i) => `e${i}`);
    expect(sitemapEntries("https://x", { events: many })).toHaveLength(SITEMAP_MAX);
  });
});

describe("robotsFor", () => {
  it("closes every environment but production", () => {
    expect(robotsFor("staging", "https://x")).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    expect(robotsFor("local", "https://x").rules[0].disallow).toBe("/");
  });

  it("production allows the site but not the private pages, and points at the sitemap", () => {
    for (const env of ["prod", "production"]) {
      const r = robotsFor(env, "https://esports.kriraghor.com");
      expect(r.rules[0]).toEqual({ userAgent: "*", allow: "/", disallow: ["/me", "/sign-in", "/signup", "/go/", "/events/*/register"] });
      expect(r.sitemap).toBe("https://esports.kriraghor.com/sitemap.xml");
    }
  });
});
