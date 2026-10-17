import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ShopView } from "@/components/market/ShopView";

export const metadata = { title: "Shop" };

async function Content({ params }: { params: PageProps<"/[locale]/shop/s/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ShopView slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ShopRoute({ params }: PageProps<"/[locale]/shop/s/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
