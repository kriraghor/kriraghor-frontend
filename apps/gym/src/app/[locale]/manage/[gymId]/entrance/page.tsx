import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Entrance } from "@/components/gym-manage/Entrance";

export const metadata = { title: "Entrance QR" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/entrance">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Entrance gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/entrance">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
