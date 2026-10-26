import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Closing } from "@/components/gym-manage/Closing";

export const metadata = { title: "Cash closing" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/fees/closing">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Closing gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/fees/closing">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
