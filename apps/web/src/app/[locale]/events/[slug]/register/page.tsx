import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RegisterTeam } from "@/components/tournaments/RegisterTeam";

export const metadata = { title: "Register a team" };

async function Content({ params }: { params: PageProps<"/[locale]/events/[slug]/register">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <RegisterTeam slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/events/[slug]/register">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-96 max-w-[760px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
