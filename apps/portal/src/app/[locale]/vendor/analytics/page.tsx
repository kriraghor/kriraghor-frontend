import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { VendorAnalytics } from "@/components/vendor/VendorAnalytics";

export const metadata = { title: "Analytics" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/analytics">["params"] }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorAnalytics />;
}

// The business and period live in the URL (useSearchParams), so the page renders inside Suspense (cacheComponents).
export default function AnalyticsPage({ params }: PageProps<"/[locale]/vendor/analytics">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
