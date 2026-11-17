import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { JoinInvite } from "@/components/teams/JoinInvite";

export const metadata = { title: "Team invite", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/[locale]/teams/join/[token]">["params"] }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <JoinInvite token={token} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/teams/join/[token]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-72 max-w-[560px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
