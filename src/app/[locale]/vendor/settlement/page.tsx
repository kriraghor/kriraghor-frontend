import { setRequestLocale } from "next-intl/server";
import { SettlementDesk } from "@/components/vendor/orders/SettlementDesk";

export const metadata = { title: "Settlement" };

export default async function SettlementPage({ params }: PageProps<"/[locale]/vendor/settlement">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettlementDesk />;
}
