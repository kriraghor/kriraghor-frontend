import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { robotsFor, siteUrl } from "@/lib/seo";

/** /robots.txt from the running environment: production is indexed, everything else is closed. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsFor(process.env.APP_ENV ?? "local", siteUrl());
}
