import { setRequestLocale } from "next-intl/server";
import { BookingsAdmin } from "@/components/admin/bookings/BookingsAdmin";

export const metadata = { title: "Bookings" };

export default async function AdminBookingsPage({ params }: PageProps<"/[locale]/admin/bookings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BookingsAdmin />;
}
