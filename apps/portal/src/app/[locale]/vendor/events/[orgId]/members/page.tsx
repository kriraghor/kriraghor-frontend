import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SportsMembers } from "@/components/vendor/tournaments/SportsConsole";

export const metadata = { title: "Members" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/events/[orgId]/members">["params"] }) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  return <SportsMembers orgId={orgId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/events/[orgId]/members">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1200px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
