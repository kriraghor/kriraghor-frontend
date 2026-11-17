import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PlayerProfileForm } from "@/components/teams/PlayerProfileForm";

export const metadata = { title: "Player profile" };

export default async function PlayerProfilePage({ params }: PageProps<"/[locale]/me/player">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-96 max-w-[760px] kg-shimmer bg-surface-2" />}>
      <PlayerProfileForm />
    </Suspense>
  );
}
