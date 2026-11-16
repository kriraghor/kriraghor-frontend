import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PlayerProfile } from "@/components/esports/Leaderboards";
import { detailMetadata } from "@/lib/seo.server";

/** "IGN · game" with rank, points, wins and kills from the public read; the share card is opengraph-image.tsx. */
export async function generateMetadata({ params }: PageProps<"/[locale]/p/[handle]">): Promise<Metadata> {
  const { locale, handle } = await params;
  return detailMetadata("player", decodeURIComponent(handle), locale, "Player");
}

async function Content({ params }: { params: PageProps<"/[locale]/p/[handle]">["params"] }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  return <PlayerProfile handle={decodeURIComponent(handle)} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function PlayerRoute({ params }: PageProps<"/[locale]/p/[handle]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
