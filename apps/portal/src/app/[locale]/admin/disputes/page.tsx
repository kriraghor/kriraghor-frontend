import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { DisputesDesk } from "@/components/admin/trust/DisputesDesk";

export const metadata = { title: "Disputes" };

async function Content({ params }: { params: PageProps<"/[locale]/admin/disputes">["params"] }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DisputesDesk />;
}

// The desk reads ?code= (links from notifications): request data, so inside Suspense (cacheComponents).
export default function DisputesPage({ params }: PageProps<"/[locale]/admin/disputes">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
