import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { InventoryDesk } from "@/components/vendor/market/InventoryDesk";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ params }: PageProps<"/[locale]/vendor/inventory">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The filter comes from the URL (?status=low), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <InventoryDesk />
    </Suspense>
  );
}
