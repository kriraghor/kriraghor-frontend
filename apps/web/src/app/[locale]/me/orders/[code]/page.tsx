import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrderView } from "@/components/orders/OrderView";

export const metadata = { title: "Order" };

async function Content({ params }: { params: PageProps<"/[locale]/me/orders/[code]">["params"] }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <OrderView code={code} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function OrderRoute({ params }: PageProps<"/[locale]/me/orders/[code]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-xl kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
