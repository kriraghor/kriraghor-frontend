import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AdminHome } from "@/components/AdminHome";

export const metadata = { title: "Admin desk" };

async function Content({ params }: { params: PageProps<"/[locale]/admin">["params"] }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminHome />;
}

// The platform period lives in the URL (useSearchParams, dashboards round 3), so the page renders inside Suspense (cacheComponents).
export default function AdminHomePage({ params }: PageProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-96 max-w-[1200px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
