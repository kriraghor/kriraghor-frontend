import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PayResult } from "@/components/payments/PayResult";

export const metadata = { title: "Payment result" };

async function Result({ params }: { params: PageProps<"/[locale]/pay/[paymentId]/result">["params"] }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  return <PayResult paymentId={paymentId} />;
}

export default function PayResultRoute({ params }: PageProps<"/[locale]/pay/[paymentId]/result">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-xl animate-pulse bg-surface-2" />}>
      <Result params={params} />
    </Suspense>
  );
}
