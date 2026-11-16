import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyVisits } from "@/components/gym-member/MyVisits";

export const metadata = { title: "My visits" };

export default async function Route({ params }: PageProps<"/[locale]/me/visits">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <MyVisits />
    </Suspense>
  );
}
