import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GroundsBrowse } from "@/components/grounds/GroundsBrowse";

export const metadata = { title: "Grounds" };

export default async function GroundsPage({ params }: PageProps<"/[locale]/grounds">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The filters live in the URL (useSearchParams), so the list renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <GroundsBrowse />
    </Suspense>
  );
}
