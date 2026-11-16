import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyTournaments } from "@/components/tournaments/MyTournaments";

export const metadata = { title: "My tournaments" };

export default async function Page({ params }: PageProps<"/[locale]/me/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <MyTournaments />
    </Suspense>
  );
}
