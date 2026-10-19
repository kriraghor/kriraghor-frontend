import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PricingEditor } from "@/components/vendor/PricingEditor";

export const metadata = { title: "Pricing" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/venues/[id]/pricing">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PricingEditor id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function PricingRoute({ params }: PageProps<"/[locale]/vendor/venues/[id]/pricing">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
