import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { HireBrowse } from "@/components/hire/HireBrowse";

export const metadata = { title: "Hire" };

export default async function HiringPage({ params }: PageProps<"/[locale]/hiring">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The filters live in the URL (useSearchParams), so the list renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <HireBrowse />
    </Suspense>
  );
}
