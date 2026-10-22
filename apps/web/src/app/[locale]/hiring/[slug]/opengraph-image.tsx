import { getTranslations } from "next-intl/server";
import { hireCard } from "@/lib/og";
import { ogContentType, ogSize, shareImage } from "@/lib/og.server";
import { publicRead } from "@/lib/seo.server";

/** The link preview for /hiring/[slug]: role, name, specialisation and area, rating and jobs (Round B1 part 5). */
export const alt = "Kriraghor hire profile";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const lang = locale === "bn" ? "bn" : "en";
  const t = await getTranslations({ locale: lang, namespace: "share.og" });
  const read = await publicRead(`/hire/profiles/${encodeURIComponent(slug)}`);
  const content = read.status === "ok" ? hireCard(read.data, lang, { rating: t("rating"), jobs: t("jobs"), years: t("years") }) : null;
  return shareImage(content, { locale: lang, brand: t("brandHire"), path: `/hiring/${encodeURIComponent(slug)}` });
}
