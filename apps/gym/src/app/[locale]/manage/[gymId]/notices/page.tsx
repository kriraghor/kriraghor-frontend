import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Notices } from "@/components/gym-ops/Notices";

export const metadata = { title: "Notices" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/notices">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Notices gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/notices">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
