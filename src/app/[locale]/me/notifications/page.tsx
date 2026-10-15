import { setRequestLocale } from "next-intl/server";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";

export const metadata = { title: "Updates" };

export default async function NotificationsPage({ params }: PageProps<"/[locale]/me/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationCentre signInHref="/sign-in" settingsHref="/me/notifications/settings" />;
}
