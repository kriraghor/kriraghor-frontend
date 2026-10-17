import { Suspense } from "react";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { BookingsDesk } from "@/components/vendor/BookingsDesk";

export const metadata = { title: "Bookings" };

async function Content({ params }: { params: PageProps<"/[locale]/vendor/bookings">["params"] }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The desk works from today's date (Asia/Dhaka), so it renders per request (cacheComponents).
  await connection();
  return <BookingsDesk />;
}

export default function BookingsPage({ params }: PageProps<"/[locale]/vendor/bookings">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-[1400px] animate-pulse bg-surface-2" />}>
      <Content params={params} />
    </Suspense>
  );
}
