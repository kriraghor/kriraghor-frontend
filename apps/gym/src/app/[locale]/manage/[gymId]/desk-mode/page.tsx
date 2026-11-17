import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { DeskModePage } from "@/components/manage/desk/DeskModePage";

export const metadata = { title: "Desk mode" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/desk-mode">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <DeskModePage gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/desk-mode">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[960px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}