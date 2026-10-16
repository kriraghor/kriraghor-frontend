import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GroundDetail } from "@/components/grounds/GroundDetail";

export const metadata = { title: "Ground" };

async function Content({ params }: { params: PageProps<"/[locale]/grounds/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <GroundDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GroundRoute({ params }: PageProps<"/[locale]/grounds/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
