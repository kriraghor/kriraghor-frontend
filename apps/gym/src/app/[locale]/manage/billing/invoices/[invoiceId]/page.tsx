import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { InvoiceDetail } from "@/components/gym-manage/InvoiceDetail";

export const metadata = { title: "Invoice" };

async function Content({ params }: { params: PageProps<"/[locale]/manage/billing/invoices/[invoiceId]">["params"] }) {
  const { locale, invoiceId } = await params;
  setRequestLocale(locale);
  return <InvoiceDetail invoiceId={invoiceId} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function Route({ params }: PageProps<"/[locale]/manage/billing/invoices/[invoiceId]">) {
  return (
    <Suspense fallback={<div className="rounded-card mx-auto mt-10 h-64 max-w-[860px] kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
