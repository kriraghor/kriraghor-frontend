import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PayPage } from "@/components/payments/PayPage";

// One person's payment: never indexed (lib/seo PRIVATE_PATHS has /pay/).
export const metadata: Metadata = { title: "Pay", robots: { index: false, follow: false } };

async function Content({ params }: { params: PageProps<"/[locale]/pay/[paymentId]">["params"] }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  return <PayPage paymentId={paymentId} />;
}

// Payment ids are request data (cacheComponents): read the params inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/pay/[paymentId]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-xl animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
