import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SearchResults } from "@/components/search/SearchResults";

export const metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ params }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The text comes from the URL (?q=), so the page renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-2xl animate-pulse bg-surface-2" />}>
      <SearchResults />
    </Suspense>
  );
}
