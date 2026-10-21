import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard, displayUrl, loadLogo } from "@kriraghor/ui/share/og";
import { siteUrl, type CardContent, type Translate } from "./seo";

export const ogSize = OG_SIZE;
export const ogContentType = "image/png";

/**
 * Draws a link-preview card. `content` null (unknown player, API asleep) gives the plain brand
 * card, so a shared link always has an image. Cached by the CDN for an hour.
 */
export async function shareImage(content: CardContent | null, t: Translate, path: string) {
  const card = content ?? { eyebrow: null, title: t("og.fallbackTitle"), subtitle: t("og.fallbackSubtitle"), stats: [] };
  return new ImageResponse(
    <ShareCard brand={t("og.brand")} eyebrow={card.eyebrow} title={card.title} subtitle={card.subtitle} stats={card.stats} footer={displayUrl(`${siteUrl()}${content ? path : ""}`)} logo={await loadLogo()} />,
    { ...OG_SIZE, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
