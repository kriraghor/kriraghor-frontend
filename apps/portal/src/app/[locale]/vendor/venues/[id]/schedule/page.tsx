import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GroundSchedule } from "@/components/vendor/GroundSchedule";

export const metadata = { title: "Closures and series" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/venues/[id]/schedule">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GroundSchedule groundId={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ScheduleRoute({ params }: PageProps<"/[locale]/vendor/venues/[id]/schedule">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
