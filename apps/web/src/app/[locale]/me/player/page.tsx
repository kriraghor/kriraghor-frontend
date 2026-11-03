import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PlayerProfileForm } from "@/components/players/PlayerProfileForm";

export const metadata = { title: "Player profile" };

export default async function PlayerProfilePage({ params }: PageProps<"/[locale]/me/player">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />}>
      <PlayerProfileForm />
    </Suspense>
  );
}
