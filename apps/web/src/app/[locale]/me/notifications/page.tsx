import { setRequestLocale } from "next-intl/server";
import { NotificationCentre } from "@kriraghor/ui/notifications/centre";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/[locale]/me/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationCentre signInHref="/sign-in" settingsHref="/me/notifications/settings" />;
}
