import { setRequestLocale } from "next-intl/server";
import { AccountSettings } from "@/components/account/AccountSettings";

export const metadata = { title: "Account settings" };

export default async function AccountSettingsPage({ params }: PageProps<"/[locale]/account/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountSettings />;
}
