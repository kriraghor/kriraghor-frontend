import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { EventPage } from "@/components/esports/EventPage";

export const metadata = { title: "Showcase" };

async function Content({ params }: { params: PageProps<"/[locale]/showcases/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <EventPage slug={decodeURIComponent(slug)} />;
}

// M23: a big event (its slug, or its id from a notification link).
export default function EventRoute({ params }: PageProps<"/[locale]/showcases/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
