import { setRequestLocale } from "next-intl/server";
import { EventsOps } from "@/components/admin/EventsOps";

export const metadata = { title: "Events" };

export default async function EventsPage({ params }: PageProps<"/[locale]/admin/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EventsOps />;
}
