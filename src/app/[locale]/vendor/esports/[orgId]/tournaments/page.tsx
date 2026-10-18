import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrgShell, OrgTournaments } from "@/components/vendor/esports/OrganiserConsole";

export const metadata = { title: "Tournaments" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/esports/[orgId]/tournaments">["params"] }) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  return (
    <OrgShell orgId={orgId}>
      <OrgTournaments orgId={orgId} />
    </OrgShell>
  );
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/esports/[orgId]/tournaments">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
