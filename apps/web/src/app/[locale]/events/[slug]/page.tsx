import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { detailJsonLd, detailMetadata } from "@/lib/seo.server";
import { JsonLd } from "@/components/JsonLd";
import { TournamentHub } from "@/components/tournaments/TournamentHub";

/** Title, description and share image from the public read; an unknown slug is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/events/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return detailMetadata("tournament", slug, locale, "Tournament", `/events/${slug}`);
}

async function Content({ params }: { params: PageProps<"/[locale]/events/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const ld = await detailJsonLd("tournament", slug, locale);
  return (
    <>
      {ld ? <JsonLd data={ld} /> : null}
      <TournamentHub slug={slug} />
    </>
  );
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/events/[slug]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-96 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
