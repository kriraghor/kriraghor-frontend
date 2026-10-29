import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { JoinForm } from "@/components/gym/Join";

export const metadata = { title: "Join this gym", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/[locale]/gyms/[slug]/join">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <JoinForm slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function JoinRoute({ params }: PageProps<"/[locale]/gyms/[slug]/join">) {
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <Content params={params} />
    </Suspense>
  );
}
