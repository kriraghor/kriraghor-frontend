import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Start } from "@/components/start/Start";

export const metadata = { title: "Start your gym" };

/** /start (M24 prompt 0): from signing in, through the gym owner application, to the first gym. */
export default async function StartPage({ params }: PageProps<"/[locale]/start">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[960px] animate-pulse bg-surface-2" />}>
      <Start />
    </Suspense>
  );
}
