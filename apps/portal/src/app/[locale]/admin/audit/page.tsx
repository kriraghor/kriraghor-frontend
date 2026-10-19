import { setRequestLocale } from "next-intl/server";
import { AuditLog } from "@/components/admin/AuditLog";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuditLog />;
}
