import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PublicPlayerView } from "@/components/teams/PublicPlayerView";

export const metadata = { title: "Player" };

async function Content({ params }: { params: PageProps<"/[locale]/players/[handle]">["params"] }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  return <PublicPlayerView handle={handle} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/players/[handle]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[900px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
