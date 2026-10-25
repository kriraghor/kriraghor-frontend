import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PassView } from "@/components/gym/PassView";

export const metadata = { title: "Gym pass" };

async function Content({ params }: { params: PageProps<"/[locale]/me/passes/[code]">["params"] }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <PassView code={code} />;
}

export default function PassRoute({ params }: PageProps<"/[locale]/me/passes/[code]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-[640px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
