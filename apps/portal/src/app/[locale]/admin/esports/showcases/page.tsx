import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { BigEventsDesk } from "@/components/admin/esports/BigEventsDesk";

export const metadata = { title: "Showcases" };

export default async function Page({ params }: PageProps<"/[locale]/admin/esports/showcases">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk reads ?id= (useSearchParams; notification links), so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <BigEventsDesk />
    </Suspense>
  );
}
