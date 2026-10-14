import { setRequestLocale } from "next-intl/server";
import { MePanel } from "@/components/MePanel";

export const metadata = { title: "My account" };

export default async function MePage({ params }: PageProps<"/[locale]/me">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MePanel />;
}
