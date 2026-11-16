import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyHome } from "@/components/gym-member/MyHome";

export const metadata = { title: "My gyms" };

/** /me on gym.kriraghor.com (M24 member area): my gyms, requests and the check-in QR; passes and plans one tap away. */
export default async function MePage({ params }: PageProps<"/[locale]/me">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[960px] kg-shimmer bg-surface-2" />}>
      <MyHome />
    </Suspense>
  );
}
