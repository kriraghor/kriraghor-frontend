import { setRequestLocale } from "next-intl/server";
import { MarketAdmin } from "@/components/admin/market/MarketAdmin";

export const metadata = { title: "Market" };

export default async function MarketAdminPage({ params }: PageProps<"/[locale]/admin/market">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketAdmin />;
}
