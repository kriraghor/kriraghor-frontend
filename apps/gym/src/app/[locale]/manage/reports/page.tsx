import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AllReports } from "@/components/gym-manage/AllReports";

export const metadata = { title: "All gyms reports" };

export default async function Route({ params }: PageProps<"/[locale]/manage/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <AllReports />
    </Suspense>
  );
}
