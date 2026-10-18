import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GymEditor } from "@/components/vendor/gym/GymEditor";

export const metadata = { title: "Gym" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/gyms/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GymEditor id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/vendor/gyms/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
