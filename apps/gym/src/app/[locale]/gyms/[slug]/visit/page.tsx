import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { VisitForm } from "@/components/gym/Visit";

export const metadata = { title: "Book a free visit", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/[locale]/gyms/[slug]/visit">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <VisitForm slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function VisitRoute({ params }: PageProps<"/[locale]/gyms/[slug]/visit">) {
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <Content params={params} />
    </Suspense>
  );
}
