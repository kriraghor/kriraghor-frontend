import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GroundEditor } from "@/components/vendor/GroundEditor";

export const metadata = { title: "Ground" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/grounds/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GroundEditor id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GroundRoute({ params }: PageProps<"/[locale]/vendor/grounds/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
