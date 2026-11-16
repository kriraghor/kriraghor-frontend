import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RiskAccountView } from "@/components/admin/risk/RiskDesk";

export const metadata = { title: "Risk account" };

async function Content({ params }: { params: PageProps<"/[locale]/admin/risk/accounts/[userId]">["params"] }) {
  const { locale, userId } = await params;
  setRequestLocale(locale);
  return <RiskAccountView userId={userId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function RiskAccountPage({ params }: PageProps<"/[locale]/admin/risk/accounts/[userId]">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-96 max-w-[1320px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
