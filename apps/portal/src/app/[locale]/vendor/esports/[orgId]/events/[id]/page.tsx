import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrgShell, OrgTournament } from "@/components/vendor/esports/OrganiserConsole";

export const metadata = { title: "Event" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/esports/[orgId]/events/[id]">["params"] }) {
  const { locale, orgId, id } = await params;
  setRequestLocale(locale);
  return (
    <OrgShell orgId={orgId}>
      <OrgTournament orgId={orgId} id={id} />
    </OrgShell>
  );
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/esports/[orgId]/events/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
