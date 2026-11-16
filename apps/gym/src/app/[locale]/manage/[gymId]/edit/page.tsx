import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GymEditor } from "@/components/manage/GymEditor";

export const metadata = { title: "Gym page" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/edit">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <GymEditor id={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/edit">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
