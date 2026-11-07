import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyClasses } from "@/components/gym-member/MyClasses";

export const metadata = { title: "My classes" };

export default async function Route({ params }: PageProps<"/[locale]/me/classes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyClasses />
    </Suspense>
  );
}
