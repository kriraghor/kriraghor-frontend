import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ProductEditor } from "@/components/vendor/market/ProductEditor";

export const metadata = { title: "Product" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/products/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ProductEditor id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function ProductRoute({ params }: PageProps<"/[locale]/vendor/products/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
