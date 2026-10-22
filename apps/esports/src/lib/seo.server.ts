import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { keysFrom, playerMeta, showcaseMeta, SITEMAP_SOURCES, tournamentMeta, type Locale, type PageMeta, type SitemapKey, type Translate } from "./seo";

/**
 * Server-side public reads for esports metadata, share cards and the sitemap (same pattern as
 * apps/web seo.server.ts). Inside the cluster the pod reaches the API by its service name
 * (INTERNAL_API_URL); elsewhere the public API_URL. A short timeout: a slow or sleeping API must
 * never hold a page up, so failures fall back to the static title and are not cached.
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

export const langOf = (locale: string): Locale => (locale === "bn" ? "bn" : "en");

/** The "share" messages as a plain translator. */
export async function shareT(locale: string): Promise<Translate> {
  const t = await getTranslations({ locale: langOf(locale), namespace: "share" });
  return (key, values) => t(key, values);
}

const DETAIL = {
  player: { path: (k: string) => `/esports/players/${encodeURIComponent(k)}`, meta: playerMeta, page: (k: string) => `/p/${encodeURIComponent(k)}` },
  tournament: { path: (k: string) => `/esports/tournaments/${encodeURIComponent(k)}`, meta: tournamentMeta, page: (k: string) => `/events/${encodeURIComponent(k)}` },
  showcase: { path: (k: string) => `/esports/events/${encodeURIComponent(k)}`, meta: showcaseMeta, page: (k: string) => `/showcases/${encodeURIComponent(k)}` },
} as const;
export type DetailKind = keyof typeof DETAIL;

/**
 * Next metadata for a detail page from its public read. An unknown key or an unreachable API gives
 * the plain fallback title (the page itself shows the not-found message).
 */
export async function detailMetadata(kind: DetailKind, key: string, locale: string, fallbackTitle: string): Promise<Metadata> {
  const d = DETAIL[kind];
  const read = await publicRead(d.path(key));
  // The player share card (opengraph-image.tsx) is wide even when the read fails.
  if (read.status !== "ok") return kind === "player" ? { title: fallbackTitle, twitter: { card: "summary_large_image" } } : { title: fallbackTitle };
  const meta: PageMeta = d.meta(read.data, langOf(locale), await shareT(locale));
  const path = d.page(key);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: path },
    openGraph: { title: meta.title, description: meta.description, url: path, ...(meta.image ? { images: [{ url: meta.image }] } : {}) },
    twitter: { card: kind === "player" || meta.image ? "summary_large_image" : "summary", title: meta.title, description: meta.description },
  };
}

/** Page keys of every public list for the sitemap, paging until a source runs out or the cap is reached. */
export async function sitemapKeys(maxPerSource = 2000) {
  const found: Partial<Record<SitemapKey, string[]>> = {};
  for (const src of SITEMAP_SOURCES) {
    const keys: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 60 && keys.length < maxPerSource; page += 1) {
      const sep = src.path.includes("?") ? "&" : "?";
      const read = await publicRead(`${src.path}${cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (read.status !== "ok") break;
      const body = read.data as { items?: Record<string, unknown>[]; nextCursor?: string | null };
      keys.push(...keysFrom(src.field, body.items));
      if (src.paging !== "cursor" || !body.nextCursor) break;
      cursor = body.nextCursor;
    }
    found[src.key] = keys.slice(0, maxPerSource);
  }
  return found;
}
