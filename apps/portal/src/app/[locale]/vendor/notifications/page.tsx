import { setRequestLocale } from "next-intl/server";
import { NotificationCentre } from "@kriraghor/ui/notifications/centre";

export const metadata = { title: "Updates" };

/** vendor.kriraghor.com updates (M08): the same centre as kriraghor.com, on the business panel. */
export default async function VendorNotificationsPage({ params }: PageProps<"/[locale]/vendor/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationCentre signInHref="/vendor/sign-in" settingsHref="/vendor/notifications/settings" />;
}
