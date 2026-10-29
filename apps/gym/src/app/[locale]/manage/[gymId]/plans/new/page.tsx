import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PlanNew } from "@/components/gym-manage/Plans";

export const metadata = { title: "New plan" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/plans/new">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <PlanNew gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/plans/new">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
