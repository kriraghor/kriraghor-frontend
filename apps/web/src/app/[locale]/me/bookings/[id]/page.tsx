import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { BookingDetail } from "@/components/bookings/BookingDetail";

export const metadata = { title: "Booking" };

async function Content({ params }: { params: PageProps<"/[locale]/me/bookings/[id]">["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <BookingDetail id={id} />;
}

// Params are request data (cacheComponents): read them inside Suspense.
export default function BookingRoute({ params }: PageProps<"/[locale]/me/bookings/[id]">) {
  return (
    <Suspense fallback={<div className="rounded-control mx-auto mt-10 h-64 max-w-xl kg-shimmer bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
