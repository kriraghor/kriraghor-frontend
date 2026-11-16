import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyTeams } from "@/components/teams/MyTeams";

export const metadata = { title: "My teams" };

export default async function MyTeamsPage({ params }: PageProps<"/[locale]/me/teams">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <MyTeams />
    </Suspense>
  );
}
