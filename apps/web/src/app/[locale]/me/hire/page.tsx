import { setRequestLocale } from "next-intl/server";
import { MyHires } from "@/components/hire/MyHires";

export const metadata = { title: "My hires" };

export default async function MyHiresPage({ params }: PageProps<"/[locale]/me/hire">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyHires />;
}
