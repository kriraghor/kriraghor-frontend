import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyDues } from "@/components/gym-member/MyDues";

export const metadata = { title: "My dues" };

export default async function Route({ params }: PageProps<"/[locale]/me/dues">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyDues />
    </Suspense>
  );
}
