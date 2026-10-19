import { setRequestLocale } from "next-intl/server";
import { MyBookings } from "@/components/bookings/MyBookings";

export const metadata = { title: "My bookings" };

export default async function MyBookingsPage({ params }: PageProps<"/[locale]/me/bookings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyBookings />;
}
