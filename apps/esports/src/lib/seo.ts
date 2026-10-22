/**
 * SEO and link previews for esports.kriraghor.com (Round B1 part 5): page metadata from the public
 * reads, the share card's content, sitemap entries and robots rules. Pure functions (the wording
 * comes in through `t`), so they are unit-tested without Next; the fetching lives in seo.server.ts.
 */

export type Locale = "en" | "bn";
/** A next-intl style translator for the "share" namespace. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;
export type PageMeta = { title: string; description: string; image: string | null };
export type OgStat = { label: string; value: string; star?: boolean };
export type CardContent = { eyebrow: string | null; title: string; subtitle: string | null; stats: OgStat[] };

const DEFAULT_SITE = "https://esports.kriraghor.com";

/** The esports site origin (no trailing slash). ESPORTS_URL is set per environment (ADR-003). */
export const siteUrl = (source: Record<string, string | undefined> = process.env) => (source.ESPORTS_URL || DEFAULT_SITE).replace(/\/+$/, "");

type Named = { nameEn?: string | null; nameBn?: string | null } | null | undefined;
const pick = (n: Named, locale: Locale) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");
const joinDot = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

/** Numbers in the reader's digits. */
export const num = (n: number, locale: Locale) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 0 }).format(n);

/** ৳ from poisha. */
export function taka(poisha: number, locale: Locale): string {
  const n = poisha / 100;
  return `৳${new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)}`;
}

/** A day in Dhaka ("21 Oct 2026"). */
export const dhakaDay = (iso: string, locale: Locale) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso));

/** One line for a meta description: whitespace collapsed, cut at a word near 160 characters. */
export function summary(text: string | null | undefined, max = 160) {
  const t = (text ?? "").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

// The public read shapes, only the fields used here (see the backend OpenAPI document).
type PlayerGame = { game: Named & { key?: string | null }; ign: string; rank: number | null; points?: number | null; tournaments?: number; wins?: number; kills?: number };
export type EsportsPlayer = { username: string | null; displayName?: string | null; tournaments?: number; wins?: number; kills?: number; games?: PlayerGame[] };
type Tournament = { titleEn: string; titleBn: string; game?: Named; prizePool?: { amount: number }; entryFee?: { amount: number }; startsAt?: string; status?: string };
type Showcase = { event?: { titleEn: string; titleBn: string; taglineEn?: string | null; taglineBn?: string | null; aboutMdEn?: string; aboutMdBn?: string; bannerUrl?: string | null; startsAt?: string; endsAt?: string; prizeTotal?: { amount: number } } };

/** The game a player is best known for: their best rank, else the first verified game. */
export function mainGame(p: EsportsPlayer): PlayerGame | null {
  const games = p.games ?? [];
  const ranked = games.filter((g) => g.rank != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return ranked[0] ?? games[0] ?? null;
}

/** /p/[handle]: "IGN · game" (the layout adds "Kriraghor Esports"), rank, points, wins and kills. */
export function playerMeta(data: unknown, locale: Locale, t: Translate): PageMeta {
  const p = data as EsportsPlayer;
  const g = mainGame(p);
  const name = g?.ign || p.displayName || p.username || t("meta.player");
  const game = g ? pick(g.game, locale) : "";
  const facts = [
    g?.rank != null && game ? t("meta.rank", { n: num(g.rank, locale), game }) : t("meta.unranked"),
    g?.points != null ? t("meta.points", { n: num(Math.round(g.points), locale) }) : null,
    t("meta.wins", { n: p.wins ?? 0 }),
    t("meta.kills", { n: p.kills ?? 0 }),
  ];
  return { title: joinDot(name, game), description: summary(`${name}: ${joinDot(...facts)}.`), image: null };
}

/** /events/[slug]: the title; game, prize pool, entry and start day. */
export function tournamentMeta(data: unknown, locale: Locale, t: Translate): PageMeta {
  const d = data as Tournament;
  const title = (locale === "bn" ? d.titleBn || d.titleEn : d.titleEn || d.titleBn) || t("meta.event");
  const facts = [
    pick(d.game, locale),
    d.prizePool?.amount ? t("meta.prizePool", { amount: taka(d.prizePool.amount, locale) }) : null,
    d.entryFee ? (d.entryFee.amount ? t("meta.entry", { amount: taka(d.entryFee.amount, locale) }) : t("meta.freeEntry")) : null,
    d.startsAt ? t("meta.starts", { date: dhakaDay(d.startsAt, locale) }) : null,
  ];
  return { title, description: summary(joinDot(...facts)), image: null };
}

/** /showcases/[slug]: the title; the tagline (or the about text), dates and the prize total. */
export function showcaseMeta(data: unknown, locale: Locale, t: Translate, site = DEFAULT_SITE): PageMeta {
  const e = (data as Showcase).event;
  if (!e) return { title: t("meta.showcase"), description: "", image: null };
  const bn = locale === "bn";
  const title = (bn ? e.titleBn || e.titleEn : e.titleEn || e.titleBn) || t("meta.showcase");
  const tagline = bn ? e.taglineBn || e.taglineEn : e.taglineEn || e.taglineBn;
  const about = bn ? e.aboutMdBn || e.aboutMdEn : e.aboutMdEn || e.aboutMdBn;
  const dates = e.startsAt ? (e.endsAt && dhakaDay(e.endsAt, locale) !== dhakaDay(e.startsAt, locale) ? `${dhakaDay(e.startsAt, locale)} – ${dhakaDay(e.endsAt, locale)}` : dhakaDay(e.startsAt, locale)) : null;
  const facts = joinDot(dates, e.prizeTotal?.amount ? t("meta.prizePool", { amount: taka(e.prizeTotal.amount, locale) }) : null);
  return {
    title,
    description: summary(tagline ? `${tagline}. ${facts}` : about || facts),
    image: e.bannerUrl ? new URL(e.bannerUrl, site).toString() : null,
  };
}

/** The share card for /p/[handle]: game above the IGN, @username under it, then rank, points, wins, kills. */
export function playerCard(data: unknown, locale: Locale, t: Translate): CardContent | null {
  const p = (data ?? {}) as EsportsPlayer;
  const g = mainGame(p);
  const title = g?.ign || p.displayName || p.username;
  if (!title) return null;
  const stats: OgStat[] = [];
  if (g?.rank != null) stats.push({ label: t("og.rank"), value: `#${num(g.rank, locale)}` });
  if (g?.points != null) stats.push({ label: t("og.points"), value: num(Math.round(g.points), locale) });
  stats.push({ label: t("og.wins"), value: num(p.wins ?? 0, locale) });
  stats.push({ label: t("og.kills"), value: num(p.kills ?? 0, locale) });
  return { eyebrow: g ? pick(g.game, locale) || null : null, title, subtitle: p.username ? `@${p.username}` : null, stats };
}

// ---------------- sitemap ----------------

export type SitemapEntry = { url: string; changeFrequency?: "daily" | "weekly" | "monthly"; priority?: number };

/** Public pages that always exist. Account, registration and room pages are never listed. */
export const STATIC_PATHS: { path: string; changeFrequency: SitemapEntry["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/events", changeFrequency: "daily", priority: 0.9 },
  { path: "/showcases", changeFrequency: "daily", priority: 0.8 },
  { path: "/leaderboards", changeFrequency: "daily", priority: 0.8 },
];

/** Where each public list lives, which field names the page, and how it becomes a path. */
export const SITEMAP_SOURCES = [
  { key: "events", path: "/esports/tournaments?limit=50", field: "slug", page: (s: string) => `/events/${s}`, paging: "cursor", priority: 0.7 },
  { key: "showcases", path: "/esports/events?limit=50", field: "slug", page: (s: string) => `/showcases/${s}`, paging: "none", priority: 0.7 },
  { key: "players", path: "/esports/top-players", field: "username", page: (s: string) => `/p/${s}`, paging: "none", priority: 0.5 },
] as const;
export type SitemapKey = (typeof SITEMAP_SOURCES)[number]["key"];

export const SITEMAP_MAX = 5000;

/** The page keys from one page of a list: drafts and cancelled showcases are left out. */
export function keysFrom(field: string, items: Record<string, unknown>[] | undefined): string[] {
  const out: string[] = [];
  for (const it of items ?? []) {
    if (it.status === "draft" || it.phase === "draft") continue;
    const v = it[field];
    if (typeof v === "string" && v) out.push(v);
  }
  return out;
}

/** Static pages first, then each source's keys; unique, capped at SITEMAP_MAX. */
export function sitemapEntries(site: string, found: Partial<Record<SitemapKey, string[]>>): SitemapEntry[] {
  const out: SitemapEntry[] = STATIC_PATHS.map((s) => ({ url: `${site}${s.path}`, changeFrequency: s.changeFrequency, priority: s.priority }));
  const seen = new Set(out.map((e) => e.url));
  for (const src of SITEMAP_SOURCES) {
    for (const key of found[src.key] ?? []) {
      const url = `${site}${src.page(encodeURIComponent(key))}`;
      if (seen.has(url)) continue;
      if (out.length >= SITEMAP_MAX) return out;
      seen.add(url);
      out.push({ url, changeFrequency: src.key === "players" ? "weekly" : "daily", priority: src.priority });
    }
  }
  return out;
}

// ---------------- robots ----------------

/** Pages a crawler has no business in (per person, sign-in, registration and redirects). */
export const PRIVATE_PATHS = ["/me", "/sign-in", "/signup", "/go/", "/events/*/register"];

/** robots.txt: only production ("prod" in Helm, "production" on Vercel) is indexed; every other environment says keep out. */
export function robotsFor(appEnv: string, site: string) {
  if (appEnv !== "prod" && appEnv !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }], sitemap: `${site}/sitemap.xml`, host: site };
}
