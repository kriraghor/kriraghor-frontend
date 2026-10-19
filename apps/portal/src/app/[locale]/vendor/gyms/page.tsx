import { setRequestLocale } from "next-intl/server";
import { GymsDesk } from "@/components/vendor/gym/GymsDesk";

export const metadata = { title: "My gyms" };

export default async function GymsPage({ params }: PageProps<"/[locale]/vendor/gyms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GymsDesk />;
}
