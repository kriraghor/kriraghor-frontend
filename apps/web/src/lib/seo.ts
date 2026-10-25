/**
 * SEO helpers (doc 09 §1, launch polish): page metadata from public reads, sitemap entries and robots
 * rules. Pure functions, so they are unit-tested without Next; the fetching lives in seo.server.ts.
 */

export type Locale = "en" | "bn";
type Named = { nameEn?: string | null; nameBn?: string | null } | null | undefined;

const DEFAULT_SITE = "https://www.kriraghor.com";

/** The public site origin (no trailing slash). WEB_URL is set per environment (ADR-003). */
export const siteUrl = (source: Record<string, string | undefined> = process.env) => (source.WEB_URL || DEFAULT_SITE).replace(/\/+$/, "");

const pick = (n: Named, locale: Locale) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");

/** One line for a meta description: whitespace collapsed, cut at a word near 160 characters. */
export function summary(text: string | null | undefined, max = 160) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

export type PageMeta = { title: string; description: string; image: string | null; jsonLd?: Record<string, unknown> };
export type MetaKind = "ground" | "product" | "shop" | "hire" | "gym" | "tournament" | "player";

// The public read shapes, only the fields used here (see the backend OpenAPI document).
type Ground = { name: string; slug: string; description?: string | null; area?: Named; addressLine?: string | null; photos?: { url: string }[]; lat?: number | null; lng?: number | null; ratingAvg?: number | null; ratingCount?: number };
type Product = { title: string; brand?: string | null; description?: string | null; photos?: { url: string }[]; shop?: { name?: string } | null };
type Shop = { name: string; about?: string | null; area?: Named };
type Hire = { name: string; headline?: string | null; bio?: string | null; role?: Named; area?: Named };
type Gym = { name: string; about?: string | null; area?: Named; cover?: string | null; photos?: { url: string }[] };
type Tournament = { name: string; slug: string; description?: string | null; sport?: Named; startDate?: string | null; endDate?: string | null; status?: string; organisation?: { name: string } | null };
type Player = { displayName: string; bio?: string | null; handle: string };

const joinDot = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Title, description, share image and (grounds, tournaments) JSON-LD for a public page. */
export function metaFor(kind: MetaKind, data: unknown, locale: Locale, site = DEFAULT_SITE): PageMeta {
  const abs = (u: string | null | undefined) => (u ? new URL(u, site).toString() : null);
  switch (kind) {
    case "ground": {
      const g = data as Ground;
      const area = pick(g.area, locale);
      const image = abs(g.photos?.[0]?.url);
      return {
        title: area ? `${g.name}, ${area}` : g.name,
        description: summary(g.description) || joinDot(g.name, area, locale === "bn" ? "অনলাইনে ভেন্যু বুক করুন" : "Book a slot online"),
        image,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "SportsActivityLocation",
          name: g.name,
          url: `${site}/venues/${g.slug}`,
          ...(image ? { image } : {}),
          ...(g.addressLine || area ? { address: { "@type": "PostalAddress", streetAddress: g.addressLine ?? undefined, addressLocality: area || undefined, addressCountry: "BD" } } : {}),
          ...(g.lat != null && g.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: g.lat, longitude: g.lng } } : {}),
          ...(g.ratingAvg && g.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: g.ratingAvg, ratingCount: g.ratingCount } } : {}),
        },
      };
    }
    case "product": {
      const p = data as Product;
      return { title: p.brand ? `${p.title} (${p.brand})` : p.title, description: summary(p.description) || joinDot(p.title, p.shop?.name), image: abs(p.photos?.[0]?.url) };
    }
    case "shop": {
      const s = data as Shop;
      return { title: s.name, description: summary(s.about) || joinDot(s.name, pick(s.area, locale)), image: null };
    }
    case "hire": {
      const h = data as Hire;
      return { title: joinDot(h.name, pick(h.role, locale)), description: summary(h.headline || h.bio) || joinDot(h.name, pick(h.role, locale), pick(h.area, locale)), image: null };
    }
    case "gym": {
      const g = data as Gym;
      const area = pick(g.area, locale);
      return { title: area ? `${g.name}, ${area}` : g.name, description: summary(g.about) || joinDot(g.name, area), image: abs(g.cover ?? g.photos?.[0]?.url) };
    }
    case "tournament": {
      const t = data as Tournament;
      const sport = pick(t.sport, locale);
      return {
        title: t.name,
        description: summary(t.description) || joinDot(t.name, sport, t.organisation?.name),
        image: null,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: t.name,
          url: `${site}/events/${t.slug}`,
          ...(t.startDate ? { startDate: t.startDate } : {}),
          ...(t.endDate ? { endDate: t.endDate } : {}),
          ...(sport ? { sport } : {}),
          eventStatus: t.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
          ...(t.organisation ? { organizer: { "@type": "Organization", name: t.organisation.name } } : {}),
        },
      };
    }
    case "player": {
      const p = data as Player;
      return { title: p.displayName, description: summary(p.bio) || `${p.displayName} (@${p.handle})`, image: null };
    }
  }
}

// ---------------- sitemap ----------------

export type SitemapEntry = { url: string; changeFrequency?: "daily" | "weekly" | "monthly"; priority?: number };

/** Public pages that always exist. Account, payment and join pages are never listed (the gym pages are in gym.kriraghor.com's sitemap). */
export const STATIC_PATHS: { path: string; changeFrequency: SitemapEntry["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/venues", changeFrequency: "daily", priority: 0.9 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/hiring", changeFrequency: "daily", priority: 0.8 },
  { path: "/events", changeFrequency: "daily", priority: 0.8 },
  { path: "/help", changeFrequency: "monthly", priority: 0.4 },
  { path: "/fair-play", changeFrequency: "monthly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/buyer-protection", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.2 },
];

/** Where each public list lives and how its items become page paths. */
export const SITEMAP_SOURCES = [
  { key: "grounds", path: "/grounds?limit=50", page: (slug: string) => `/venues/${slug}`, paging: "cursor" },
  { key: "products", path: "/market/items?limit=48", page: (slug: string) => `/shop/p/${slug}`, paging: "cursor" },
  { key: "hire", path: "/hire/profiles?limit=50", page: (slug: string) => `/hiring/${slug}`, paging: "cursor" },
  { key: "tournaments", path: "/tournaments?limit=48", page: (slug: string) => `/events/${slug}`, paging: "offset" },
] as const;

export const SITEMAP_MAX = 5000;

/** Static pages first, then each source's slugs; unique, capped at SITEMAP_MAX. */
export function sitemapEntries(site: string, found: Partial<Record<(typeof SITEMAP_SOURCES)[number]["key"], string[]>>): SitemapEntry[] {
  const out: SitemapEntry[] = STATIC_PATHS.map((s) => ({ url: `${site}${s.path}`, changeFrequency: s.changeFrequency, priority: s.priority }));
  const seen = new Set(out.map((e) => e.url));
  for (const src of SITEMAP_SOURCES) {
    for (const slug of found[src.key] ?? []) {
      const url = `${site}${src.page(encodeURIComponent(slug))}`;
      if (seen.has(url)) continue;
      if (out.length >= SITEMAP_MAX) return out;
      seen.add(url);
      out.push({ url, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  return out;
}

// ---------------- robots ----------------

/** Pages a crawler has no business in (private, per person, or one-time links). */
export const PRIVATE_PATHS = ["/me", "/account", "/pay", "/pro", "/teams/join", "/sign-in", "/go/"];

/** robots.txt: only production ("prod" in Helm, "production" on Vercel) is indexed; every other environment says keep out. */
export function robotsFor(appEnv: string, site: string) {
  if (appEnv !== "prod" && appEnv !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }], sitemap: `${site}/sitemap.xml`, host: site };
}
