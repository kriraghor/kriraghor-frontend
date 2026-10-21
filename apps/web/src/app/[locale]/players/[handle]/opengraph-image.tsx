import { getTranslations } from "next-intl/server";
import { playerCard } from "@/lib/og";
import { ogContentType, ogSize, shareImage } from "@/lib/og.server";
import { publicRead } from "@/lib/seo.server";

/** The link preview for /players/[handle]: name, sports with positions, teams (Round B1 part 5). Never gender, age or phone. */
export const alt = "Kriraghor player";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const lang = locale === "bn" ? "bn" : "en";
  const t = await getTranslations({ locale: lang, namespace: "share.og" });
  const read = await publicRead(`/players/${encodeURIComponent(handle)}`);
  const content = read.status === "ok" ? playerCard(read.data, lang, { player: t("player"), sports: t("sports"), teams: t("teams") }) : null;
  return shareImage(content, { locale: lang, brand: t("brandPlayers"), path: `/players/${encodeURIComponent(handle)}` });
}
