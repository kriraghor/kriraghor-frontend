import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TournamentList } from "@/components/esports/TournamentList";

export const metadata = { title: "Tournaments" };

export default async function Page({ params }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}><TournamentList /></Suspense>;
}
