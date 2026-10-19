import { setRequestLocale } from "next-intl/server";
import { AdminHome } from "@/components/AdminHome";

export const metadata = { title: "Admin desk" };

export default async function AdminHomePage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminHome />;
}
