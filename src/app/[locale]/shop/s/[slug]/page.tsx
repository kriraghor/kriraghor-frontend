import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { detailMetadata, pageMeta } from "@/lib/seo.server";
import { ShopView } from "@/components/market/ShopView";

/** Title, description and share image from the public read; an unknown slug is a 404 (seo.server). */
export async function generateMetadata({ params }: PageProps<"/[locale]/shop/s/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  return detailMetadata("shop", slug, locale, "Shop", `/shop/s/${slug}`);
}

async function Content({ params }: { params: PageProps<"/[locale]/shop/s/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await pageMeta("shop", slug, locale);
  return <ShopView slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ShopRoute({ params }: PageProps<"/[locale]/shop/s/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
