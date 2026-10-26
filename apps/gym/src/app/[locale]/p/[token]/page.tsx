import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PayLink } from "@/components/gym-member/PayLink";

// A payment link behind a signed token: never indexed, never in the sitemap (lib/seo PRIVATE_PATHS has /p/).
export const metadata: Metadata = { title: "Pay your gym fee", robots: { index: false, follow: false } };

async function Content({ params }: { params: PageProps<"/[locale]/p/[token]">["params"] }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <PayLink token={token} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/p/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-80 max-w-[560px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
