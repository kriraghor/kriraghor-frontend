import { setRequestLocale } from "next-intl/server";
import { GymsDesk } from "@/components/manage/GymsDesk";

export const metadata = { title: "My gyms" };

export default async function GymsPage({ params }: PageProps<"/[locale]/manage">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GymsDesk />;
}
