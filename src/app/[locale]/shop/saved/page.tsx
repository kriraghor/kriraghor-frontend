import { setRequestLocale } from "next-intl/server";
import { SavedView } from "@/components/market/SavedView";

export const metadata = { title: "Saved items" };

export default async function SavedPage({ params }: PageProps<"/[locale]/shop/saved">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedView />;
}
