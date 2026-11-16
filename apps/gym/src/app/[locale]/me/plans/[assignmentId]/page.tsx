import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyPlanDetail } from "@/components/gym-member/MyPlans";

export const metadata = { title: "My plan" };

async function Content({ params }: { params: PageProps<"/[locale]/me/plans/[assignmentId]">["params"] }) {
  const { locale, assignmentId } = await params;
  setRequestLocale(locale);
  return <MyPlanDetail assignmentId={assignmentId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/me/plans/[assignmentId]">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[960px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
