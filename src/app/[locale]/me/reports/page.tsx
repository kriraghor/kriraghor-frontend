import { setRequestLocale } from "next-intl/server";
import { MyReports } from "@/components/trust/MyReportsReviews";

export const metadata = { title: "My reports" };

export default async function MyReportsPage({ params }: PageProps<"/[locale]/me/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyReports />;
}
