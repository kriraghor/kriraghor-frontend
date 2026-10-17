import { setRequestLocale } from "next-intl/server";
import { ReportsDesk } from "@/components/admin/trust/ReportsDesk";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportsDesk />;
}
