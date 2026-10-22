import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl, sitemapEntries } from "@/lib/seo";
import { sitemapKeys } from "@/lib/seo.server";

/**
 * /sitemap.xml: the static pages, then every public event, showcase and top player. Built at
 * request time (never at build, when the API may be asleep) from cached reads; when the API can't
 * answer, the static pages alone are listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries(siteUrl(), await sitemapKeys());
}
