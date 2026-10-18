import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrgShell, OrgBranding } from "@/components/vendor/esports/OrganiserConsole";

export const metadata = { title: "Branding" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/esports/[orgId]/branding">["params"] }) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  return (
    <OrgShell orgId={orgId}>
      <OrgBranding orgId={orgId} />
    </OrgShell>
  );
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/esports/[orgId]/branding">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1200px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
