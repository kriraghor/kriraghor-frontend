import { setRequestLocale } from "next-intl/server";
import { GymAdmin } from "@/components/admin/gym/GymAdmin";

export const metadata = { title: "Gyms" };

export default async function GymAdminPage({ params }: PageProps<"/[locale]/admin/gym">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GymAdmin />;
}
