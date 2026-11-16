import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { TeamView } from "@/components/teams/TeamView";

export const metadata = { title: "Team" };

async function Content({ params }: { params: PageProps<"/[locale]/me/teams/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TeamView id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/me/teams/[id]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-96 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
