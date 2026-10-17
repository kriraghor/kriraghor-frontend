import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { HireProfileView } from "@/components/hire/HireProfileView";

export const metadata = { title: "Hire" };

async function Content({ params }: { params: PageProps<"/[locale]/hiring/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <HireProfileView slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/hiring/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
