import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PlayerProfile } from "@/components/esports/Leaderboards";

export const metadata = { title: "Player" };

async function Content({ params }: { params: PageProps<"/[locale]/p/[handle]">["params"] }) {
  const { locale, handle } = await params;
  setRequestLocale(locale);
  return <PlayerProfile handle={decodeURIComponent(handle)} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function PlayerRoute({ params }: PageProps<"/[locale]/p/[handle]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
