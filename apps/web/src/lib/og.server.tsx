import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OG_SIZE, ShareCard, displayUrl, loadLogo } from "@kriraghor/ui/share/og";
import type { CardContent } from "./og";
import { siteUrl } from "./seo";

export const ogSize = OG_SIZE;
export const ogContentType = "image/png";

/**
 * Draws a link-preview card for a page. `content` null (unknown slug, API asleep) gives the plain
 * brand card, so a shared link always has an image. Cached by the CDN for an hour.
 */
export async function shareImage(content: CardContent | null, opts: { locale: string; brand: string; path: string }) {
  const t = await getTranslations({ locale: opts.locale === "bn" ? "bn" : "en", namespace: "share.og" });
  const card = content ?? { eyebrow: null, title: t("fallbackTitle"), subtitle: t("fallbackSubtitle"), stats: [] };
  return new ImageResponse(
    <ShareCard brand={opts.brand} eyebrow={card.eyebrow} title={card.title} subtitle={card.subtitle} stats={card.stats} footer={displayUrl(`${siteUrl()}${content ? opts.path : ""}`)} logo={await loadLogo()} />,
    { ...OG_SIZE, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
