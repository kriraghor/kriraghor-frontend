import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Reminders } from "@/components/gym-manage/Reminders";

export const metadata = { title: "Reminders" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/reminders">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Reminders gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/reminders">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
