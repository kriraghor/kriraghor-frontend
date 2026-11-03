import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metaFor, siteUrl, SITEMAP_SOURCES, type Locale, type MetaKind, type PageMeta } from "./seo";

/**
 * Server-side public reads for metadata and the sitemap. Inside the cluster the web pod reaches the
 * API by its service name (INTERNAL_API_URL); elsewhere the public API_URL. Every call has a short
 * timeout: a slow or sleeping API (Render cold start) must never hold a page up, so failures fall
 * back to the static title and are not cached.
 */
const apiBase = () => (process.env.INTERNAL_API_URL || process.env.API_URL || "http://localhost:4000/api/v1").replace(/\/+$/, "");
const TIMEOUT_MS = 3000;

type Read = { status: "ok"; data: unknown } | { status: "missing" };

/** One public GET, cached for an hour. Throws (so nothing is cached) when the API can't answer. */
async function cachedRead(path: string): Promise<Read> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(`${apiBase()}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return { status: "ok", data: await res.json() };
}

export async function publicRead(path: string): Promise<Read | { status: "unavailable" }> {
  try {
    return await cachedRead(path);
  } catch {
    return { status: "unavailable" };
  }
}

const DETAIL: Record<MetaKind, (key: string) => string> = {
  ground: (s) => `/grounds/${encodeURIComponent(s)}`,
  product: (s) => `/market/products/${encodeURIComponent(s)}`,
  shop: (s) => `/market/shops/${encodeURIComponent(s)}`,
  hire: (s) => `/hire/profiles/${encodeURIComponent(s)}`,
  gym: (s) => `/gym/gyms/${encodeURIComponent(s)}`,
  tournament: (s) => `/tournament-posts/${encodeURIComponent(s)}`,
  player: (s) => `/players/${encodeURIComponent(s)}`,
};

/**
 * The page's meta from its public read. A 404 from the API is a real not-found page (crawlers get
 * the 404 status); an unreachable API gives the static fallback title and the page renders as usual.
 */
export async function pageMeta(kind: MetaKind, key: string, locale: string): Promise<PageMeta | null> {
  const read = await publicRead(DETAIL[kind](key));
  if (read.status === "missing") notFound();
  if (read.status !== "ok") return null;
  return metaFor(kind, read.data, locale === "bn" ? "bn" : ("en" as Locale), siteUrl());
}

/** Next metadata for a detail page, with a plain fallback title. */
export async function detailMetadata(kind: MetaKind, key: string, locale: string, fallbackTitle: string, path: string): Promise<Metadata> {
  const meta = await pageMeta(kind, key, locale);
  if (!meta) return { title: fallbackTitle };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: path },
    openGraph: { title: meta.title, description: meta.description, url: path, ...(meta.image ? { images: [{ url: meta.image }] } : {}) },
    twitter: { card: meta.image ? "summary_large_image" : "summary", title: meta.title, description: meta.description },
  };
}

/** JSON-LD for a page (grounds and tournaments), or null. Reuses the cached read. */
export async function detailJsonLd(kind: MetaKind, key: string, locale: string) {
  const meta = await pageMeta(kind, key, locale);
  return meta?.jsonLd ?? null;
}

/** Slugs of every public list for the sitemap, paging until a source runs out or the cap is reached. */
export async function sitemapSlugs(maxPerSource = 2000) {
  const found: Record<string, string[]> = {};
  for (const src of SITEMAP_SOURCES) {
    const slugs: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 60 && slugs.length < maxPerSource; page += 1) {
      const sep = src.path.includes("?") ? "&" : "?";
      const at = cursor == null ? "" : `${sep}cursor=${encodeURIComponent(String(cursor))}`;
      const read = await publicRead(`${src.path}${at}`);
      if (read.status !== "ok") break;
      const body = read.data as { items?: { slug?: string; kind?: string }[]; nextCursor?: string | null };
      const items = body.items ?? [];
      // Shop items only: used listings (M13 step 2) will get their own pages.
      for (const it of items) if (it.slug && (src.key !== "products" || !it.kind || it.kind === "shop")) slugs.push(it.slug);
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    found[src.key] = slugs;
  }
  return found;
}
