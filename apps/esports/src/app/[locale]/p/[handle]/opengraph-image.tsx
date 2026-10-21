import { playerCard } from "@/lib/seo";
import { ogContentType, ogSize, shareImage } from "@/lib/og.server";
import { langOf, publicRead, shareT } from "@/lib/seo.server";

/** The link preview for /p/[handle]: game, IGN, @username, rank, points, wins and kills (Round B1 part 5). Never the UID. */
export const alt = "Kriraghor Esports player";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const key = decodeURIComponent(handle);
  const t = await shareT(locale);
  const read = await publicRead(`/esports/players/${encodeURIComponent(key)}`);
  const content = read.status === "ok" ? playerCard(read.data, langOf(locale), t) : null;
  return shareImage(content, t, `/p/${encodeURIComponent(key)}`);
}
