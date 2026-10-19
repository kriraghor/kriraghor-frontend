import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TournamentConsole } from "@/components/vendor/tournaments/SportsConsole";

export const metadata = { title: "Event console" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/events/[orgId]/e/[id]">["params"] }) {
  const { locale, orgId, id } = await params;
  setRequestLocale(locale);
  return <TournamentConsole orgId={orgId} id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/events/[orgId]/e/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
