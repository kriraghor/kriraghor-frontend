import { setRequestLocale } from "next-intl/server";
import { OwnerAnalytics } from "@/components/vendor/OwnerDashboard";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: PageProps<"/[locale]/vendor/analytics">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OwnerAnalytics />;
}
