import { setRequestLocale } from "next-intl/server";
import { MyRoles } from "@/components/account/MyRoles";

export const metadata = { title: "My roles" };

export default async function AccountRolesPage({ params }: PageProps<"/[locale]/account/roles">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyRoles />;
}
