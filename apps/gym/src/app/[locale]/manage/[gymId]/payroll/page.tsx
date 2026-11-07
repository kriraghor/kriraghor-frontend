import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Payroll } from "@/components/gym-ops/Payroll";

export const metadata = { title: "Payroll" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/payroll">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <Payroll gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/payroll">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
