import { setRequestLocale } from "next-intl/server";
import { TeamsAdmin } from "@/components/admin/teams/TeamsAdmin";

export const metadata = { title: "Teams" };

export default async function TeamsAdminPage({ params }: PageProps<"/[locale]/admin/teams">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TeamsAdmin />;
}
