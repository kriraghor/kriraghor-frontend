import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Reports } from "@/components/gym-manage/Reports";

export const metadata = { title: "Reports" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/reports">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Reports gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/reports">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
