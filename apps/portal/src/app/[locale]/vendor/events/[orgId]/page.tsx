import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SportsTournaments } from "@/components/vendor/tournaments/SportsConsole";

export const metadata = { title: "Events" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/events/[orgId]">["params"] }) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  return <SportsTournaments orgId={orgId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/events/[orgId]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
