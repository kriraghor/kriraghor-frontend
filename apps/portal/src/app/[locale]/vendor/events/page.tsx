import { setRequestLocale } from "next-intl/server";
import { SportsHome } from "@/components/vendor/tournaments/SportsConsole";

export const metadata = { title: "Tournaments" };

export default async function Page({ params }: PageProps<"/[locale]/vendor/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SportsHome />;
}
