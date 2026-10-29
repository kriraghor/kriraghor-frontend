/**
 * SEO and link previews for gym.kriraghor.com: a gym page's metadata from its public read, sitemap
 * entries and robots rules. Pure functions, unit-tested; the fetching lives in seo.server.ts (the same
 * rules as kriraghor.com's lib/seo, where the gym pages lived until 25 Oct 2026).
 */

export type Locale = "en" | "bn";
export type PageMeta = { title: string; description: string; image: string | null };

const DEFAULT_SITE = "https://gym.kriraghor.com";

/** The gym site origin (no trailing slash). GYM_URL is set per environment (ADR-003). */
export const siteUrl = (source: Record<string, string | undefined> = process.env) => (source.GYM_URL || DEFAULT_SITE).replace(/\/+$/, "");

type Named = { nameEn?: string | null; nameBn?: string | null } | null | undefined;
const pick = (n: Named, locale: Locale) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");
const joinDot = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** One line for a meta description: whitespace collapsed, cut at a word near 160 characters. */
export function summary(text: string | null | undefined, max = 160) {
  const t = (text ?? "").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

// The public read's shape, only the fields used here (see the backend OpenAPI document).
type Gym = { name: string; about?: string | null; area?: Named; cover?: string | null; photos?: { url: string }[] };

/** /gyms/[slug]: "Name, Area"; the about text (or name and area); the cover or first photo. */
export function gymMeta(data: unknown, locale: Locale, site = DEFAULT_SITE): PageMeta {
  const g = data as Gym;
  const area = pick(g.area, locale);
  const image = g.cover ?? g.photos?.[0]?.url;
  return { title: area ? `${g.name}, ${area}` : g.name, description: summary(g.about) || joinDot(g.name, area), image: image ? new URL(image, site).toString() : null };
}

// ---------------- sitemap ----------------

export type SitemapEntry = { url: string; changeFrequency?: "daily" | "weekly" | "monthly"; priority?: number };

/** Public pages that always exist. Account, management and sign-in pages are never listed. */
export const STATIC_PATHS: { path: string; changeFrequency: SitemapEntry["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/gyms", changeFrequency: "daily", priority: 0.9 },
  { path: "/trainers", changeFrequency: "weekly", priority: 0.8 },
];

/** Where the public gym list lives and how its items become page paths. */
export const GYMS_SOURCE = { path: "/gym/gyms?limit=48", page: (slug: string) => `/gyms/${slug}` } as const;

export const SITEMAP_MAX = 5000;

/** Static pages first, then each gym page; unique, capped at SITEMAP_MAX. */
export function sitemapEntries(site: string, slugs: string[]): SitemapEntry[] {
  const out: SitemapEntry[] = STATIC_PATHS.map((s) => ({ url: `${site}${s.path}`, changeFrequency: s.changeFrequency, priority: s.priority }));
  const seen = new Set(out.map((e) => e.url));
  for (const slug of slugs) {
    const url = `${site}${GYMS_SOURCE.page(encodeURIComponent(slug))}`;
    if (seen.has(url)) continue;
    if (out.length >= SITEMAP_MAX) break;
    seen.add(url);
    out.push({ url, changeFrequency: "weekly", priority: 0.7 });
  }
  return out;
}

// ---------------- robots ----------------

/** Pages a crawler has no business in (per person, management, sign-in, redirects, the signed receipt links /r/, the pay pages /pay/ and the payment links /p/). */
export const PRIVATE_PATHS = ["/me", "/manage", "/start", "/sign-in", "/signup", "/go/", "/r/", "/pay/", "/p/"];

/** robots.txt: only production ("prod" in Helm, "production" on Vercel) is indexed; every other environment says keep out. */
export function robotsFor(appEnv: string, site: string) {
  if (appEnv !== "prod" && appEnv !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }], sitemap: `${site}/sitemap.xml`, host: site };
}
