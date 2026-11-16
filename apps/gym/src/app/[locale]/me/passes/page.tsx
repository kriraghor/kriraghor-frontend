import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyPasses } from "@/components/gym/MyPasses";

export const metadata = { title: "My subscriptions" };

export default async function MyPassesPage({ params }: PageProps<"/[locale]/me/passes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <MyPasses />
    </Suspense>
  );
}
