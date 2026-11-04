import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { detailMetadata, pageMeta } from "@/lib/seo.server";
import { PublicPlayerView } from "@/components/teams/PublicPlayerView";

/** Title, description and share image from the public read; an unknown handle is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/players/[handle]">): Promise<Metadata> {
  const { locale, handle } = await params;
  const meta = await detailMetadata("player", handle, locale, "Player", `/players/${handle}`);
  // The share card (opengraph-image.tsx) is a wide image.
  return { ...meta, twitter: { ...meta.twitter, card: "summary_large_image" } };
}

async function Content({ params }: { params: PageProps<"/[locale]/players/[handle]">["params"] }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  await pageMeta("player", handle, locale);
  return <PublicPlayerView handle={handle} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/players/[handle]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[900px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
