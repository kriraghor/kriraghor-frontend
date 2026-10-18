import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TournamentHub } from "@/components/tournaments/TournamentHub";

export const metadata = { title: "Tournament" };

async function Content({ params }: { params: PageProps<"/[locale]/tournaments/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <TournamentHub slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/tournaments/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
