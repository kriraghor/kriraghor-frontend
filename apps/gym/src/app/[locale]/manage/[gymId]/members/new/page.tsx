import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MemberNew } from "@/components/gym-manage/MemberNew";

export const metadata = { title: "Add a member" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/members/new">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <MemberNew gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/members/new">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
