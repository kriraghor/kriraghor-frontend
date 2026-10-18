import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyPasses } from "@/components/gym/MyPasses";

export const metadata = { title: "My passes" };

export default async function MyPassesPage({ params }: PageProps<"/[locale]/me/passes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyPasses />
    </Suspense>
  );
}
