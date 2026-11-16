import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PayResult } from "@/components/payments/PayResult";

// One person's payment: never indexed (lib/seo PRIVATE_PATHS has /pay/).
export const metadata: Metadata = { title: "Payment result", robots: { index: false, follow: false } };

async function Content({ params }: { params: PageProps<"/[locale]/pay/[paymentId]/result">["params"] }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  return <PayResult paymentId={paymentId} />;
}

// Payment ids are request data (cacheComponents): read the params inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/pay/[paymentId]/result">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-40 max-w-xl kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
