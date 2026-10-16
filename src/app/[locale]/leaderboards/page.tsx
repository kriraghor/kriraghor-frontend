import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Leaderboards } from "@/components/esports/Leaderboards";

export const metadata = { title: "Leaderboards" };

export default async function Page({ params }: PageProps<"/[locale]/leaderboards">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}><Leaderboards /></Suspense>;
}
