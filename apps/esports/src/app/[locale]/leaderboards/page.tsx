import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Leaderboards } from "@/components/esports/Leaderboards";
import { shareT } from "@/lib/seo.server";

export async function generateMetadata({ params }: PageProps<"/[locale]/leaderboards">): Promise<Metadata> {
  const { locale } = await params;
  const t = await shareT(locale);
  return { title: t("meta.leaderboardsTitle"), description: t("meta.leaderboards"), alternates: { canonical: "/leaderboards" }, openGraph: { title: t("meta.leaderboardsTitle"), description: t("meta.leaderboards"), url: "/leaderboards" } };
}

export default async function Page({ params }: PageProps<"/[locale]/leaderboards">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}><Leaderboards /></Suspense>;
}
