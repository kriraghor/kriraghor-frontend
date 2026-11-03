import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PassesSold } from "@/components/manage/PassesSold";

export const metadata = { title: "Subscriptions sold" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/passes">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <PassesSold id={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/passes">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
