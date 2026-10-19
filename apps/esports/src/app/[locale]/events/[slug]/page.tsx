import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TournamentDetail } from "@/components/esports/TournamentDetail";

export const metadata = { title: "Event" };

async function Content({ params }: { params: PageProps<"/[locale]/events/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <TournamentDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function TournamentRoute({ params }: PageProps<"/[locale]/events/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
