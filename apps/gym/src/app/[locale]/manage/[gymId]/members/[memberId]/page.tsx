import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MemberProfile } from "@/components/gym-manage/MemberProfile";

export const metadata = { title: "Member" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/members/[memberId]">["params"] }) {
  const { locale, gymId, memberId } = await params;
  setRequestLocale(locale);
  return <MemberProfile gymId={gymId} memberId={memberId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/members/[memberId]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
