import { setRequestLocale } from "next-intl/server";
import { NotificationCentre } from "@kriraghor/ui/notifications/centre";

export const metadata = { title: "Updates" };

export default async function AdminNotificationsPage({ params }: PageProps<"/[locale]/admin/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationCentre signInHref="/admin/sign-in" />;
}
