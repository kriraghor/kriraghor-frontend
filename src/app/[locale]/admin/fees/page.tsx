import { setRequestLocale } from "next-intl/server";
import { FeesAndRules } from "@/components/admin/FeesAndRules";

export const metadata = { title: "Fees and rules" };

export default async function FeesPage({ params }: PageProps<"/[locale]/admin/fees">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FeesAndRules />;
}
