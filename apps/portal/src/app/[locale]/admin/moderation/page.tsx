import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ModerationDesk } from "@/components/admin/moderation/ModerationDesk";

export const metadata = { title: "Moderation" };

export default async function ModerationPage({ params }: PageProps<"/[locale]/admin/moderation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk reads ?kind= and ?id= (useSearchParams), so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <ModerationDesk />
    </Suspense>
  );
}
