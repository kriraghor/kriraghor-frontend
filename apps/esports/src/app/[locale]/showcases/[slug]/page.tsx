import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { EventPage } from "@/components/esports/EventPage";
import { detailMetadata } from "@/lib/seo.server";

/** The title with tagline, dates and prize total (and the banner as the share image) from the public read. */
export async function generateMetadata({ params }: PageProps<"/[locale]/showcases/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return detailMetadata("showcase", decodeURIComponent(slug), locale, "Showcase");
}

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
