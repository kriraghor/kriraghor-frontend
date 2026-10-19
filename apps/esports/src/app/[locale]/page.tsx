import { setRequestLocale } from "next-intl/server";
import { Home } from "@/components/esports/Home";

export const metadata = { title: "Home" };

export default async function Page({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}
