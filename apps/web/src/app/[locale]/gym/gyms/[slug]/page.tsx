import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { detailMetadata, pageMeta } from "@/lib/seo.server";
import { GymDetail } from "@/components/gym/GymDetail";

/** Title, description and share image from the public read; an unknown slug is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/gym/gyms/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return detailMetadata("gym", slug, locale, "Gym", `/gym/gyms/${slug}`);
}

async function Content({ params }: { params: PageProps<"/[locale]/gym/gyms/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await pageMeta("gym", slug, locale);
  return <GymDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GymRoute({ params }: PageProps<"/[locale]/gym/gyms/[slug]">) {
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <Content params={params} />
    </Suspense>
  );
}
