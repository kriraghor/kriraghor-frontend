import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PassesSold } from "@/components/vendor/gym/PassesSold";

export const metadata = { title: "Passes sold" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/gyms/[id]/passes">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PassesSold id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/gyms/[id]/passes">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
