import { setRequestLocale } from "next-intl/server";
import { TeamDesk } from "@/components/vendor/TeamDesk";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/[locale]/vendor/team">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TeamDesk />;
}
