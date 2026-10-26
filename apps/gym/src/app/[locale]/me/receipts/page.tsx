import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyReceipts } from "@/components/gym-member/MyReceipts";

export const metadata = { title: "My receipts" };

export default async function Route({ params }: PageProps<"/[locale]/me/receipts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyReceipts />
    </Suspense>
  );
}
