import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrdersDesk } from "@/components/vendor/orders/OrdersDesk";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ params }: PageProps<"/[locale]/vendor/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The tab and the open order come from the URL (?tab=to_ship&id=…), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <OrdersDesk />
    </Suspense>
  );
}
