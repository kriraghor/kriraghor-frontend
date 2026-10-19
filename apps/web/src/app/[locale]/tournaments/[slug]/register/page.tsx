import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RegisterTeam } from "@/components/tournaments/RegisterTeam";

export const metadata = { title: "Register a team" };

async function Content({ params }: { params: PageProps<"/[locale]/tournaments/[slug]/register">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <RegisterTeam slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/tournaments/[slug]/register">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[760px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
