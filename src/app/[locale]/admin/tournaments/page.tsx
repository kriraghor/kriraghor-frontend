import { setRequestLocale } from "next-intl/server";
import { TournamentsAdmin } from "@/components/admin/tournaments/TournamentsAdmin";

export const metadata = { title: "Tournaments" };

export default async function TournamentsAdminPage({ params }: PageProps<"/[locale]/admin/tournaments">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TournamentsAdmin />;
}
