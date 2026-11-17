import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { BusinessPage } from "@/components/kyc/BusinessPage";

export const metadata = { title: "Business" };

export default async function AccountBusinessPage({ params }: PageProps<"/[locale]/account/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The role comes from the URL (?as=shop), so the page renders inside Suspense.
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-40 max-w-2xl kg-shimmer bg-surface-2" />}>
      <BusinessPage />
    </Suspense>
  );
}
