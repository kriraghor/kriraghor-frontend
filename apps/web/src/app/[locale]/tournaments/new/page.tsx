import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PostEditor } from "@/components/tournaments/PostEditor";

export const metadata = { title: "Post a tournament" };

export default async function Page({ params }: PageProps<"/[locale]/tournaments/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <PostEditor />
    </Suspense>
  );
}
