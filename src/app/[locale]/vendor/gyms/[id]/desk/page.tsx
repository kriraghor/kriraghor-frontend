import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { FrontDesk } from "@/components/vendor/gym/FrontDesk";

export const metadata = { title: "Front desk" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/gyms/[id]/desk">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <FrontDesk id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/gyms/[id]/desk">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
