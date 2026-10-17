import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MarketBrowse } from "@/components/market/MarketBrowse";

export const metadata = { title: "Shop" };

export default async function ShopPage({ params }: PageProps<"/[locale]/shop">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The filters live in the URL (useSearchParams), so the list renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <MarketBrowse />
    </Suspense>
  );
}
