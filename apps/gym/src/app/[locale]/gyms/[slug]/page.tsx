import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { gymMetadata, gymPageMeta } from "@/lib/seo.server";
import { GymDetail } from "@/components/gym/GymDetail";

/** Title, description and share image from the public read; an unknown slug is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/gyms/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return gymMetadata(slug, locale, "Gym");
}

async function Content({ params }: { params: PageProps<"/[locale]/gyms/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await gymPageMeta(slug, locale);
  return <GymDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GymRoute({ params }: PageProps<"/[locale]/gyms/[slug]">) {
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <Content params={params} />
    </Suspense>
  );
}
