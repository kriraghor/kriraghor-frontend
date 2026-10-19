import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RegisterFlow } from "@/components/esports/RegisterFlow";
import { SignedIn } from "@/components/esports/SignedIn";

export const metadata = { title: "Register" };

async function Content({ params }: { params: PageProps<"/[locale]/events/[slug]/register">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <SignedIn><RegisterFlow slug={slug} /></SignedIn>;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function RegisterRoute({ params }: PageProps<"/[locale]/events/[slug]/register">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
