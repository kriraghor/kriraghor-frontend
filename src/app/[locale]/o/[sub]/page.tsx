import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { OrganiserPage } from "@/components/esports/OrganiserPage";

export const metadata = { title: "Organiser" };

async function Content({ params }: { params: PageProps<"/[locale]/o/[sub]">["params"] }) {
  const { locale, sub } = await params;
  setRequestLocale(locale);
  return <OrganiserPage sub={decodeURIComponent(sub)} />;
}

// M22: an organiser's branded page; {sub}.esports.kriraghor.com/ is rewritten here (proxy.ts).
export default function OrganiserRoute({ params }: PageProps<"/[locale]/o/[sub]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1320px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
