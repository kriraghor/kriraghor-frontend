import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyCheckin } from "@/components/gym-member/MyCheckin";

export const metadata = { title: "My check-in QR" };

export default async function Route({ params }: PageProps<"/[locale]/me/checkin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyCheckin />
    </Suspense>
  );
}
