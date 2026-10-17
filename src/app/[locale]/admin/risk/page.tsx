import { setRequestLocale } from "next-intl/server";
import { RiskDesk } from "@/components/admin/risk/RiskDesk";

export const metadata = { title: "Risk" };

export default async function RiskPage({ params }: PageProps<"/[locale]/admin/risk">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RiskDesk />;
}
