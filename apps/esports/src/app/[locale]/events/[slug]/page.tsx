import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { TournamentDetail } from "@/components/esports/TournamentDetail";
import { detailMetadata } from "@/lib/seo.server";

/** The title with game, prize pool, entry and start day from the public read. */
export async function generateMetadata({ params }: PageProps<"/[locale]/events/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return detailMetadata("tournament", slug, locale, "Tournament");
}

async function Content({ params }: { params: PageProps<"/[locale]/events/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <TournamentDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function TournamentRoute({ params }: PageProps<"/[locale]/events/[slug]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
