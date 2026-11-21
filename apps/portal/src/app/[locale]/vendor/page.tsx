import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { VendorHome } from "@/components/vendor/VendorHome";

export const metadata = { title: "Business desk" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor">["params"] }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorHome />;
}

/**
 * Vendor home (M09): where a ground owner stands, and the way into the grounds desk. The period
 * lives in the URL since dashboards round 2 (useSearchParams), so the page renders inside Suspense
 * (cacheComponents), as /vendor/analytics.
 */
export default function VendorPage({ params }: PageProps<"/[locale]/vendor">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-48 max-w-3xl kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
