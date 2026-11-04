import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { EsportsDesk } from "@/components/admin/esports/EsportsDesk";

export const metadata = { title: "Esports tournaments" };

export default async function EsportsDeskPage({ params }: PageProps<"/[locale]/admin/esports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk reads ?tab= and ?id= (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <EsportsDesk />
    </Suspense>
  );
}
