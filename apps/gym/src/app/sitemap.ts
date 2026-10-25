import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl, sitemapEntries } from "@/lib/seo";
import { gymSlugs } from "@/lib/seo.server";

/**
 * /sitemap.xml: the landing page, the gym hub, then every public gym. Built at request time (never at
 * build, when the API may be asleep) from cached reads; when the API can't answer, the static pages
 * alone are listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries(siteUrl(), await gymSlugs());
}
