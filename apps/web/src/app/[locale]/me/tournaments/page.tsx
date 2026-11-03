import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyTournaments } from "@/components/tournaments/MyTournaments";

export const metadata = { title: "My tournaments" };

export default async function Page({ params }: PageProps<"/[locale]/me/tournaments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <MyTournaments />
    </Suspense>
  );
}
