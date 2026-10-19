import { setRequestLocale } from "next-intl/server";
import { GroundsAdmin } from "@/components/admin/grounds/GroundsAdmin";

export const metadata = { title: "Venues" };

export default async function AdminGroundsPage({ params }: PageProps<"/[locale]/admin/venues">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GroundsAdmin />;
}
