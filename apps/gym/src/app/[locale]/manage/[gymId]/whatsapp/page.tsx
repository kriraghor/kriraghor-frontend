import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { WhatsappPage } from "@/components/gym-manage/Whatsapp";

export const metadata = { title: "WhatsApp" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/[gymId]/whatsapp">["params"] }) {
  const { locale, gymId } = await params;
  setRequestLocale(locale);
  return <WhatsappPage gymId={gymId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/[gymId]/whatsapp">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
