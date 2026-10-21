import { setRequestLocale } from "next-intl/server";
import { NotificationSettings } from "@kriraghor/ui/notifications/settings";

export const metadata = { title: "Notification settings" };

/** vendor.kriraghor.com notification settings (M08): one set of preferences for the whole account. */
export default async function VendorNotificationSettingsPage({ params }: PageProps<"/[locale]/vendor/notifications/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationSettings signInHref="/vendor/sign-in" />;
}
