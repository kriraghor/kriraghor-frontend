import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { EventList } from "@/components/esports/EventList";

export const metadata = { title: "Events" };

export default async function Page({ params }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <EventList />
    </Suspense>
  );
}
