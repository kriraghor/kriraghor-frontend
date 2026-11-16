import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { MyMembership } from "@/components/gym-member/MyMembership";

export const metadata = { title: "My membership" };

async function Content({ params }: { params: PageProps<"/[locale]/me/memberships/[memberId]">["params"] }) {
  const { locale, memberId } = await params;
  setRequestLocale(locale);
  return <MyMembership memberId={memberId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/me/memberships/[memberId]">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
