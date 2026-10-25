import { setRequestLocale } from "next-intl/server";
import { NotificationSettings } from "@kriraghor/ui/notifications/settings";

export const metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage({ params }: PageProps<"/[locale]/me/notifications/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationSettings signInHref="/sign-in" />;
}
