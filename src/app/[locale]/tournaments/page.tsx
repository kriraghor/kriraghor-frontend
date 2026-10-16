import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TournamentList } from "@/components/esports/TournamentList";

export const metadata = { title: "Tournaments" };

export default async function Page({ params }: PageProps<"/[locale]/tournaments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}><TournamentList /></Suspense>;
}
