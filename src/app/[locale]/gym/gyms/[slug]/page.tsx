import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GymDetail } from "@/components/gym/GymDetail";

export const metadata = { title: "Gym" };

async function Content({ params }: { params: PageProps<"/[locale]/gym/gyms/[slug]">["params"] }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <GymDetail slug={slug} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function GymRoute({ params }: PageProps<"/[locale]/gym/gyms/[slug]">) {
  return (
    <Suspense fallback={<div data-theme="gym" className="min-h-[70dvh]" />}>
      <Content params={params} />
    </Suspense>
  );
}
