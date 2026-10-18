import { setRequestLocale } from "next-intl/server";
import { OrganiserHome } from "@/components/vendor/esports/OrganiserConsole";

export const metadata = { title: "Organiser console" };

export default async function Page({ params }: PageProps<"/[locale]/vendor/esports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrganiserHome />;
}
