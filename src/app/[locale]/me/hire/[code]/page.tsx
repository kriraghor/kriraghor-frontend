import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { HireRequestView } from "@/components/hire/HireRequestView";

export const metadata = { title: "Hire request" };

async function Content({ params }: { params: PageProps<"/[locale]/me/hire/[code]">["params"] }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <HireRequestView code={code} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/me/hire/[code]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
