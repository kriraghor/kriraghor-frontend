import { redirect } from "@kriraghor/ui/i18n/navigation";

/** /account itself (older links, and the backend's "account suspended" notices) opens the settings. */
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  redirect({ href: "/account/settings", locale });
}
