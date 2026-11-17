import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { EventList } from "@/components/esports/EventList";

export const metadata = { title: "Showcases" };

export default async function Page({ params }: PageProps<"/[locale]/showcases">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <EventList />
    </Suspense>
  );
}
