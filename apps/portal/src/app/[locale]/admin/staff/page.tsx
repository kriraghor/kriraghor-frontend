import { setRequestLocale } from "next-intl/server";
import { StaffDesk } from "@/components/admin/staff/StaffDesk";

export const metadata = { title: "Staff and permissions" };

export default async function AdminStaffPage({ params }: PageProps<"/[locale]/admin/staff">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StaffDesk />;
}
