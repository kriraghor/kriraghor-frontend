import { setRequestLocale } from "next-intl/server";
import { TournamentsAdmin } from "@/components/admin/tournaments/TournamentsAdmin";

export const metadata = { title: "Sports events" };

export default async function TournamentsAdminPage({ params }: PageProps<"/[locale]/admin/sports-events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TournamentsAdmin />;
}
