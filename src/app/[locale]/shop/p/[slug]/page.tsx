import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ProductView } from "@/components/market/ProductView";

export const metadata = { title: "Product" };

async function Content({ params }: { params: PageProps<"/[locale]/shop/p/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ProductView slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ProductRoute({ params }: PageProps<"/[locale]/shop/p/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
