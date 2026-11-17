import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PayPage } from "@/components/payments/PayPage";

export const metadata = { title: "Pay" };

/** Payment ids are only known at request time: read the params inside Suspense (cacheComponents). */
async function Pay({ params }: { params: PageProps<"/[locale]/pay/[paymentId]">["params"] }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  return <PayPage paymentId={paymentId} />;
}

export default function PayRoute({ params }: PageProps<"/[locale]/pay/[paymentId]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-40 max-w-xl kg-shimmer bg-surface-2" />}>
      <Pay params={params} />
    </Suspense>
  );
}
