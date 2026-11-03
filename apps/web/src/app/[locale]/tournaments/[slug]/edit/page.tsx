import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PostEditor } from "@/components/tournaments/PostEditor";

export const metadata = { title: "Edit tournament post" };

async function Content({ params }: { params: PageProps<"/[locale]/tournaments/[slug]/edit">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <PostEditor slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/tournaments/[slug]/edit">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-3xl animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
