import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { detailMetadata, pageMeta } from "@/lib/seo.server";
import { HireProfileView } from "@/components/hire/HireProfileView";

/** Title, description and share image from the public read; an unknown slug is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/hiring/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = await detailMetadata("hire", slug, locale, "Hire", `/hiring/${slug}`);
  // The share card (opengraph-image.tsx) is a wide image.
  return { ...meta, twitter: { ...meta.twitter, card: "summary_large_image" } };
}

async function Content({ params }: { params: PageProps<"/[locale]/hiring/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await pageMeta("hire", slug, locale);
  return <HireProfileView slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/hiring/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
