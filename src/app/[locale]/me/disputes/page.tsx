import { setRequestLocale } from "next-intl/server";
import { MyDisputes } from "@/components/trust/MyDisputes";

export const metadata = { title: "My disputes" };

export default async function MyDisputesPage({ params }: PageProps<"/[locale]/me/disputes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyDisputes />;
}
