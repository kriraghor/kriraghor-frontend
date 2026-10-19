import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OwnerDisputes } from "@/components/vendor/OwnerTrust";

export const metadata = { title: "Dispute" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/disputes/[code]">["params"] }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <OwnerDisputes initial={code} />;
}

// Notifications link here; params are request data (cacheComponents), so inside Suspense.
export default function OwnerDisputePage({ params }: PageProps<"/[locale]/vendor/disputes/[code]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
