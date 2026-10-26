import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PublicReceipt } from "@/components/gym-manage/PublicReceipt";

// A receipt behind a signed link: never indexed, never in the sitemap (lib/seo PRIVATE_PATHS has /r/).
export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

async function Content({ params }: { params: PageProps<"/[locale]/r/[token]">["params"] }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <PublicReceipt token={token} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/r/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[640px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
