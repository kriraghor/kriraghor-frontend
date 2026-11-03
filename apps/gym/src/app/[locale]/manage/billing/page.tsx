import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Billing } from "@/components/gym-manage/Billing";

export const metadata = { title: "Plan and billing" };

export default async function Route({ params }: PageProps<"/[locale]/manage/billing">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Billing />
    </Suspense>
  );
}
