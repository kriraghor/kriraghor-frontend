import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyEligibility } from "@/components/teams/MyEligibility";

export const metadata = { title: "Ready to play" };

export default async function EligibilityPage({ params }: PageProps<"/[locale]/me/eligibility">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />}>
      <MyEligibility />
    </Suspense>
  );
}
