import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OwnerPayouts } from "@/components/gym-manage/OwnerPayouts";

export const metadata = { title: "Payouts" };

export default async function Route({ params }: PageProps<"/[locale]/manage/payouts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <OwnerPayouts />
    </Suspense>
  );
}
