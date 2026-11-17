import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ProShell } from "@/components/hire/ProDesk";
import { ProfileEditor } from "@/components/hire/ProfileEditor";

export const metadata = { title: "Hire profile" };

async function Content({ params }: { params: PageProps<"/[locale]/pro/profiles/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <ProShell>
      <ProfileEditor id={id} />
    </ProShell>
  );
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/pro/profiles/[id]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
