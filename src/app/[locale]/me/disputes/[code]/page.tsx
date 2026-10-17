import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { DisputeDetail } from "@/components/trust/DisputeDetail";

export const metadata = { title: "Dispute" };

async function Content({ params }: { params: PageProps<"/[locale]/me/disputes/[code]">["params"] }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <DisputeDetail code={code} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function DisputeRoute({ params }: PageProps<"/[locale]/me/disputes/[code]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-2xl animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
