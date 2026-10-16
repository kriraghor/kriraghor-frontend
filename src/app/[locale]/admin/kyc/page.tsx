import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { KycDesk } from "@/components/admin/kyc/KycDesk";

export const metadata = { title: "KYC" };

export default async function KycPage({ params }: PageProps<"/[locale]/admin/kyc">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk reads ?id= (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <KycDesk />
    </Suspense>
  );
}
