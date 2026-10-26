import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyMemberships } from "@/components/gym-member/MyHome";

export const metadata = { title: "My gyms" };

export default async function Route({ params }: PageProps<"/[locale]/me/memberships">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <MyMemberships />
    </Suspense>
  );
}
