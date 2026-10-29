import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PlanEdit } from "@/components/gym-manage/Plans";

export const metadata = { title: "Plan" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/plans/[planId]">["params"] }) {
  const { locale, gymId, planId } = await params;
  setRequestLocale(locale);
  return <PlanEdit gymId={gymId} planId={planId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/plans/[planId]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
