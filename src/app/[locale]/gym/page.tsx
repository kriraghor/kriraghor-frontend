import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GymHub } from "@/components/gym/GymHub";

export const metadata = { title: "Gym" };

export default async function GymPage({ params }: PageProps<"/[locale]/gym">) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The tab and filters live in the URL (useSearchParams), so the hub renders inside Suspense.
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <GymHub />
    </Suspense>
  );
}
