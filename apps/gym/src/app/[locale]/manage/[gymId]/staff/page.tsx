import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Staff } from "@/components/gym-ops/Staff";

export const metadata = { title: "Staff attendance" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/staff">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Staff gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/staff">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
