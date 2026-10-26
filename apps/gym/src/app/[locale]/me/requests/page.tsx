import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyRequests } from "@/components/gym-member/MyRequests";

export const metadata = { title: "Gym requests" };

export default async function Route({ params }: PageProps<"/[locale]/me/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyRequests />
    </Suspense>
  );
}
