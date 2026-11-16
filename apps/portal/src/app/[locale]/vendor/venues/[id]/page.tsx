import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GroundEditor } from "@/components/vendor/GroundEditor";

export const metadata = { title: "Venue" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/venues/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GroundEditor id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GroundRoute({ params }: PageProps<"/[locale]/vendor/venues/[id]">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
