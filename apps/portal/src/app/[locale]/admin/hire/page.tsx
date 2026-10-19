import { setRequestLocale } from "next-intl/server";
import { HireAdmin } from "@/components/admin/hire/HireAdmin";

export const metadata = { title: "Hire" };

export default async function HireAdminPage({ params }: PageProps<"/[locale]/admin/hire">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HireAdmin />;
}
