import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GYMS_SOURCE, gymMeta, siteUrl, type Locale, type PageMeta } from "./seo";

/**
 * Server-side public reads for gym metadata and the sitemap (ported from kriraghor.com's seo.server).
 * Inside the cluster the pod reaches the API by its service name (INTERNAL_API_URL); elsewhere the
 * public API_URL. A short timeout: a slow or sleeping API must never hold a page up, so failures fall
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

/**
 * A gym page's meta from its public read. A 404 from the API is a real not-found page (crawlers get
 * the 404 status); an unreachable API gives the static fallback title and the page renders as usual.
 */
export async function gymPageMeta(slug: string, locale: string): Promise<PageMeta | null> {
  const read = await publicRead(`/gym/gyms/${encodeURIComponent(slug)}`);
  if (read.status === "missing") notFound();
  if (read.status !== "ok") return null;
  return gymMeta(read.data, locale === "bn" ? "bn" : ("en" as Locale), siteUrl());
}

/** Next metadata for /gyms/[slug], with a plain fallback title. */
export async function gymMetadata(slug: string, locale: string, fallbackTitle: string): Promise<Metadata> {
  const meta = await gymPageMeta(slug, locale);
  if (!meta) return { title: fallbackTitle };
  const path = `/gyms/${slug}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: path },
    openGraph: { title: meta.title, description: meta.description, url: path, ...(meta.image ? { images: [{ url: meta.image }] } : {}) },
    twitter: { card: meta.image ? "summary_large_image" : "summary", title: meta.title, description: meta.description },
  };
}

/** Slugs of every public gym for the sitemap, paging until the list runs out or the cap is reached. */
export async function gymSlugs(max = 2000): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 60 && slugs.length < max; page += 1) {
    const read = await publicRead(`${GYMS_SOURCE.path}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (read.status !== "ok") break;
    const body = read.data as { items?: { slug?: string }[]; nextCursor?: string | null };
    for (const it of body.items ?? []) if (it.slug) slugs.push(it.slug);
    if (!body.nextCursor) break;
    cursor = body.nextCursor;
  }
  return slugs.slice(0, max);
}
