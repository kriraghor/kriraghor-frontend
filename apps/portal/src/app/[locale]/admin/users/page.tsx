import { setRequestLocale } from "next-intl/server";
import { UsersDesk } from "@/components/admin/users/UsersDesk";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({ params }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UsersDesk />;
}
