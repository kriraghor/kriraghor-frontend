import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { FinanceDesk } from "@/components/admin/finance/FinanceDesk";

export const metadata = { title: "Finance" };

export default async function FinancePage({ params }: PageProps<"/[locale]/admin/finance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk reads ?tab= (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <FinanceDesk />
    </Suspense>
  );
}
